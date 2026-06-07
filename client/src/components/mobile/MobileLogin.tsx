import LoginForm from "@/components/LoginForm";

interface Props {
  onSubmit: (data: { email: string; password: string }) => Promise<void>;
  serverError: string | null;
}

/**
 * Phone login: a dark editorial hero (grid + glow + wordmark) over the shared
 * LoginForm — the form keeps all auth/validation logic; only the chrome around
 * it is mobile-bespoke.
 */
export default function MobileLogin({ onSubmit, serverError }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Hero — always dark regardless of theme (scoped `dark`). */}
      <div className="dark relative overflow-hidden rounded-b-[28px] bg-background px-6 pb-8 pt-[calc(env(safe-area-inset-top)+28px)] text-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-[320px] rounded-full opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklch, var(--primary) 32%, transparent), transparent 70%)",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-baseline gap-2">
            <span className="display-serif text-[22px] leading-none text-foreground">
              Helpdesk
            </span>
            <span aria-hidden className="display-serif italic text-[22px] text-primary">
              .
            </span>
          </span>
          <h1 className="display-serif mt-7 text-[38px] leading-[0.98] text-foreground">
            AI-powered ticket <span className="italic text-primary">management.</span>
          </h1>
          <p className="mt-4 text-[13.5px] leading-[1.55] text-muted-foreground">
            Tickets auto-classify on arrival, AI drafts your replies, and the obvious
            questions resolve themselves.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-7">
        <h2 className="display-serif mb-2 text-[30px] text-foreground">Welcome back.</h2>
        <p className="mb-6 text-[14px] text-muted-foreground">
          Enter your credentials to access the console.
        </p>
        <LoginForm onSubmit={onSubmit} serverError={serverError} />
        <p className="mt-8 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/60">
          Authorized agents only
        </p>
      </div>
    </div>
  );
}
