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
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./lib/sentry";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./lib/theme";

const queryClient = new QueryClient();

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
