import { type AcceptInviteFormData, acceptInviteFormSchema } from "@helpdesk/core";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import axios from "axios";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import FieldError from "@/components/ui/FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();

  const [invitee, setInvitee] = useState<{ name: string; email: string } | null>(null);
  const [validating, setValidating] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInviteFormData>({
    resolver: standardSchemaResolver(acceptInviteFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Pre-check the token so a dead link fails fast (and we can greet by name).
  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setValidating(false);
      return;
    }
    let active = true;
    axios
      .get("/api/invites/validate", { params: { token } })
      .then((r) => {
        if (active) setInvitee(r.data);
      })
      .catch(() => {
        if (active) setInvalid(true);
      })
      .finally(() => {
        if (active) setValidating(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function onSubmit({ password }: AcceptInviteFormData) {
    try {
      const { data } = await axios.post<{ email: string }>("/api/invites/accept", {
        token,
        password,
      });
      // Sign in through the normal path so the login gate is honored.
      await signIn.email({ email: data.email, password });
      navigate("/");
    } catch (err) {
      setError("password", {
        message: axios.isAxiosError(err)
          ? (err.response?.data?.error ?? "Couldn't accept the invitation")
          : "Couldn't accept the invitation",
      });
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-[380px]">
        <p className="eyebrow mb-3">Helpdesk · Agent console</p>

        {validating ? (
          <div
            className="flex items-center gap-2 text-ink-3"
            role="status"
            aria-label="Validating invitation"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden /> Checking your
            invitation…
          </div>
        ) : invalid ? (
          <>
            <h1 className="display-serif text-[40px] leading-tight text-foreground">
              Invitation expired
            </h1>
            <p className="mt-3 text-[14.5px] text-ink-3">
              This invitation link is invalid or has expired. Ask an administrator to send
              a new one.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block font-mono text-[12px] uppercase tracking-[0.08em] text-accent-ink hover:text-foreground"
            >
              Back to sign in →
            </Link>
          </>
        ) : (
          <>
            <h1 className="display-serif text-[40px] leading-tight text-foreground">
              Welcome{invitee ? `, ${invitee.name.split(/\s+/)[0]}` : ""}.
            </h1>
            <p className="mt-3 text-[14.5px] text-ink-3">
              Set a password to finish setting up
              {invitee ? ` ${invitee.email}` : " your account"}.
            </p>
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="mt-8 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="accept-password">Password</Label>
                <div className="relative">
                  <Input
                    id="accept-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    autoFocus
                    aria-invalid={!!errors.password}
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center rounded-md px-3 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
                <FieldError message={errors.password?.message} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="accept-confirm-password">Confirm password</Label>
                <Input
                  id="accept-confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  aria-invalid={!!errors.confirmPassword}
                  {...register("confirmPassword")}
                />
                <FieldError message={errors.confirmPassword?.message} />
              </div>
              <Button
                type="submit"
                variant="accent"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Setting up…" : "Set password & sign in"}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
