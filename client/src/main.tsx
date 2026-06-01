import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
// Font imports as JS, not CSS @import. The fontsource packages contain a
// CSS file with `url(./files/*.woff2)` references; Tailwind v4 + Vite inline
// those at @import time without rebasing the url() paths, so the woff2
// files never reach Rollup and `dist/` ships without them (system fonts
// fall back). Importing them as JS lets Vite trace each url() correctly.
import "@fontsource-variable/hanken-grotesk/wght.css";
import "@fontsource-variable/jetbrains-mono/index.css";
// Newsreader's optical-size axis (opsz 6..72) keeps display headlines crisp at
// large sizes; the italic face carries the wordmark "." and the login hero.
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "./lib/sentry";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./lib/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry expected auth/rate-limit failures — retrying just amplifies
      // them. Better Auth's 10-request-per-60s ceiling (server/src/lib/auth.ts)
      // turned this into a visible 429 burst on first-load logins.
      retry: (failureCount, error) => {
        const status =
          (error as { response?: { status?: number } })?.response?.status ??
          (error as { status?: number })?.status;
        if (status === 401 || status === 429) return false;
        return failureCount < 3;
      },
      // Same-tab navigation within 30s reuses cached data instead of refetching.
      staleTime: 30_000,
      // Tab-focus refetches were spammy and not load-bearing for an internal tool.
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
