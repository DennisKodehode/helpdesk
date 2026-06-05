import { type ResetPasswordFormData, resetPasswordFormSchema } from "@helpdesk/core";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import FieldError from "@/components/ui/FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  // Better Auth redirects here with ?error=INVALID_TOKEN when the link is dead.
  const tokenError = params.get("error");

  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: standardSchemaResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const invalid = !token || !!tokenError;

  async function onSubmit({ newPassword }: ResetPasswordFormData) {
    // Reset does NOT create a session — the user signs in afterward through the
    // normal path, which honors the active-only login gate.
    const { error } = await resetPassword({ newPassword, token });
    if (error) {
      setError("newPassword", {
        message: error.message ?? "Couldn't reset your password. Request a new link.",
      });
      return;
    }
    setDone(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-[380px]">
        <p className="eyebrow mb-3">Helpdesk · Agent console</p>

        {invalid ? (
          <>
            <h1 className="display-serif text-[40px] leading-tight text-foreground">
              Link expired
            </h1>
            <p className="mt-3 text-[14.5px] text-ink-3">
              This password reset link is invalid or has expired. Request a new one to try
              again.
            </p>
            <Link
              to="/forgot-password"
              className="mt-6 inline-block font-mono text-[12px] uppercase tracking-[0.08em] text-accent-ink hover:text-foreground"
            >
              Request a new link →
            </Link>
          </>
        ) : done ? (
          <>
            <h1 className="display-serif text-[40px] leading-tight text-foreground">
              Password updated
            </h1>
            <p className="mt-3 text-[14.5px] text-ink-3">
              Your password has been reset. Sign in with your new password to continue.
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
              Set a new password
            </h1>
            <p className="mt-3 text-[14.5px] text-ink-3">
              Choose a new password for your account.
            </p>
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="mt-8 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reset-password">New password</Label>
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    autoFocus
                    aria-invalid={!!errors.newPassword}
                    className="pr-10"
                    {...register("newPassword")}
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
                <FieldError message={errors.newPassword?.message} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reset-confirm-password">Confirm password</Label>
                <Input
                  id="reset-confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
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
                {isSubmitting ? "Updating…" : "Reset password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
