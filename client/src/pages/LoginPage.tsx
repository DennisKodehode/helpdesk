import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import LoginForm from "@/components/LoginForm";
import MobileLogin from "@/components/mobile/MobileLogin";
import { useLayoutTier } from "@/lib/useBreakpoint";
import { signIn, useSession } from "../lib/auth-client";

export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session, isPending } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const tier = useLayoutTier();

  if (!isPending && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(data: { email: string; password: string }) {
    setServerError(null);
    const { error } = await signIn.email(data);
    if (error) {
      setServerError(error.message ?? "Invalid credentials");
    } else {
      // Drop any cached query state from the unauthenticated page (and any
      // stale 401 error states from a previous session in the same tab).
      // Without this the dashboard briefly flashes "Failed to load…" while
      // queries refetch with the new session.
      queryClient.clear();
      navigate("/", { replace: true });
    }
  }

  if (tier === "mobile") {
    return <MobileLogin onSubmit={onSubmit} serverError={serverError} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen md:grid-cols-[1.05fr_1fr]">
        {/* Editorial left panel — always dark regardless of theme. Scoping it
            with `dark` resolves every token to its dark value, so the hero
            reads the same in light mode as in dark. */}
        <aside className="dark relative hidden flex-col justify-between overflow-hidden border-r border-border bg-background p-12 text-foreground md:flex xl:p-16 2xl:p-20">
          {/* Subtle grid texture */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
          />
          {/* Violet glow, top-left */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-32 size-[460px] rounded-full opacity-70 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklch, var(--primary) 32%, transparent), transparent 70%)",
            }}
          />

          <div className="relative">
            <p className="eyebrow">Helpdesk · Agent Console</p>
          </div>

          <div className="relative space-y-7">
            <h1 className="display-serif text-[44px] leading-[0.95] text-foreground md:text-[74px]">
              AI-powered
              <br />
              ticket
              <br />
              <span className="italic text-primary">management.</span>
            </h1>
            <p className="max-w-md text-[16px] leading-[1.65] text-muted-foreground">
              Tickets are auto-classified on arrival, AI polishes your draft replies
              before you send them, and the obvious questions resolve themselves. Your
              team handles what needs a human.
            </p>
          </div>

          <div className="relative flex items-end justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
            <span>Issue №&thinsp;01</span>
            <span>MMXXVI</span>
          </div>
        </aside>

        {/* Form right panel */}
        <main className="flex items-center justify-center px-6 py-12 md:px-12 xl:px-16 2xl:px-20">
          <div className="w-full max-w-[380px]">
            <div className="mb-10 space-y-2 xl:mb-12 2xl:mb-14">
              <p className="eyebrow">Sign in</p>
              <h2 className="display-serif text-[32px] text-foreground md:text-[40px]">
                Welcome back.
              </h2>
              <p className="text-[14.5px] text-muted-foreground">
                Enter your credentials to access the console.
              </p>
            </div>
            <LoginForm onSubmit={onSubmit} serverError={serverError} />

            <p className="mt-10 font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/60">
              Authorized agents only
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
