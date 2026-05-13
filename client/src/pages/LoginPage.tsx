import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { signIn, useSession } from "../lib/auth-client";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);

  if (!isPending && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(data: { email: string; password: string }) {
    setServerError(null);
    const { error } = await signIn.email(data);
    if (error) {
      setServerError(error.message ?? "Invalid credentials");
    } else {
      navigate("/", { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen md:grid-cols-2">
        {/* Editorial left panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-12 md:flex">
          {/* Subtle grid texture */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />

          <div className="relative">
            <p className="eyebrow">Helpdesk · Agent Console</p>
          </div>

          <div className="relative space-y-7">
            <h1 className="display-serif text-[64px] leading-[0.95] tracking-[-0.02em] text-foreground">
              Quiet,<br />
              <span className="italic text-primary">decisive</span><br />
              support.
            </h1>
            <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              A workspace for support teams who care about how a reply reads, how
              fast it arrives, and how it makes the customer feel afterwards.
            </p>
          </div>

          <div className="relative flex items-end justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            <span>Issue №&thinsp;01</span>
            <span>MMXXVI</span>
          </div>
        </aside>

        {/* Form right panel */}
        <main className="flex items-center justify-center px-6 py-12 md:px-12">
          <div className="w-full max-w-sm">
            <div className="mb-10 space-y-2">
              <p className="eyebrow">Sign in</p>
              <h2 className="display-serif text-3xl leading-tight tracking-tight text-foreground">
                Welcome back.
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter your credentials to access the console.
              </p>
            </div>
            <LoginForm onSubmit={onSubmit} serverError={serverError} />

            <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
              Authorized agents only
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
