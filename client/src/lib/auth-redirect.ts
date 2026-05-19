import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { signOut } from "./auth-client";

// Guards against a burst of 401s (every in-flight query when a session dies)
// each kicking off its own teardown. The first one wins; the rest are no-ops
// until a later 2xx response clears it.
let handlingUnauthorized = false;

/**
 * Installs a global axios response interceptor that treats a 401 from any of
 * our `/api/*` endpoints as "the session is gone" — expired, revoked, or
 * signed out in another tab.
 *
 * Why this exists: useSession can optimistically render the app from a cached
 * session that the server has since invalidated. The authenticated queries
 * then fire and 401 before useSession revalidates. Rather than let React Query
 * surface those as transient "Failed to load…" errors (and Sentry log them as
 * bugs), we tear the session down and redirect to /login in one move.
 *
 * Better Auth's own `/api/auth/*` calls go through better-fetch, not axios, so
 * they never reach this interceptor — and signOut() below can't loop through
 * it either.
 */
export function useUnauthorizedRedirect() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => {
        // Auth works again — reset so a future session death is handled.
        handlingUnauthorized = false;
        return response;
      },
      (error) => {
        const status = error?.response?.status;
        if (status === 401) {
          // Tag so Sentry's beforeSend drops it — an expired session is
          // expected, not a bug worth alerting on.
          error.isExpectedAuthError = true;

          if (!handlingUnauthorized && window.location.pathname !== "/login") {
            handlingUnauthorized = true;
            // Abort the rest of the in-flight burst so siblings don't 401
            // too, drop cached state, clear Better Auth's session store,
            // then redirect once.
            queryClient.cancelQueries().catch(() => {});
            queryClient.clear();
            signOut()
              .catch(() => {})
              .finally(() => navigate("/login", { replace: true }));
          }
        }
        return Promise.reject(error);
      },
    );

    return () => axios.interceptors.response.eject(interceptorId);
  }, [navigate, queryClient]);
}
