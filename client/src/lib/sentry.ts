import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
  tracesSampleRate: 0,
  beforeSend(event, hint) {
    // An expired or revoked session surfaces as a 401 from our API. That's
    // expected — the user just needs to sign in again — not a bug worth an
    // alert. useUnauthorizedRedirect already tears the session down and
    // redirects; drop the event here so prod Sentry stays signal.
    const err = hint?.originalException as
      | { response?: { status?: number }; isExpectedAuthError?: boolean }
      | undefined;
    if (err?.isExpectedAuthError || err?.response?.status === 401) {
      return null;
    }
    return event;
  },
});
