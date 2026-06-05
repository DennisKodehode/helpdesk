import {
  type RequestPasswordResetData,
  requestPasswordResetSchema,
} from "@helpdesk/core";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import FieldError from "@/components/ui/FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  // One terminal "check your inbox" state. We never reveal whether the email
  // matched an account — Better Auth's request-password-reset is itself
  // enumeration-safe, and we mirror that in the UI by always showing success.
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestPasswordResetData>({
    resolver: standardSchemaResolver(requestPasswordResetSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: RequestPasswordResetData) {
    // redirectTo must be a trusted origin (CLIENT_URL); Better Auth appends
    // ?token=... (or ?error=INVALID_TOKEN) when it redirects here from the email.
    await requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSent(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-[380px]">
        <p className="eyebrow mb-3">Helpdesk · Agent console</p>

        {sent ? (
          <>
            <h1 className="display-serif text-[40px] leading-tight text-foreground">
              Check your inbox
            </h1>
            <p className="mt-3 text-[14.5px] text-ink-3">
              If that email matches an account, we've sent a link to reset your password.
              The link expires in 1 hour.
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
              Forgot password?
            </h1>
            <p className="mt-3 text-[14.5px] text-ink-3">
              Enter your account email and we'll send you a link to set a new password.
            </p>
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="mt-8 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@example.com"
                  autoFocus
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                <FieldError message={errors.email?.message} />
              </div>
              <Button
                type="submit"
                variant="accent"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending…" : "Send reset link"}
              </Button>
            </form>
            <Link
              to="/login"
              className="mt-6 inline-block font-mono text-[12px] uppercase tracking-[0.08em] text-accent-ink hover:text-foreground"
            >
              Back to sign in →
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
