import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || "development",
  // Performance tracing off to stay within the free tier (5K errors/month).
  tracesSampleRate: 0,
  // Bun doesn't implement util.getSystemErrorMap(); the default NodeSystemError
  // integration calls it in processEvent on any errno-bearing exception and
  // throws, masking the real error. Drop it until Bun ships the API.
  integrations: (defaults) => defaults.filter((i) => i.name !== "NodeSystemError"),
});
