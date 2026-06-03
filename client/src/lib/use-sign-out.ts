import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "./auth-client";

/**
 * Shared sign-out used by every nav chrome (sidebar, tablet rail, mobile menu).
 *
 * Abort any genuinely in-flight authenticated request before the session is
 * invalidated, so a polling tick mid-flight doesn't land on the server after
 * signOut() deletes the session row. `cancelQueries()` fires
 * `AbortSignal.abort()` on each query; every authenticated queryFn forwards that
 * signal into axios so the underlying fetch actually closes.
 *
 * Do NOT navigate("/login") imperatively here, and do NOT `queryClient.clear()`.
 * Better Auth's `useSession` transitions to null on its own get-session
 * revalidation after signOut, at which point `ProtectedLayout` returns
 * `<Navigate to="/login" />` and the dashboard subtree unmounts cleanly.
 * Imperative navigation before useSession is null caused a /→/login→/→/login
 * bounce and a 401 request burst. Cache hygiene happens in LoginPage.onSubmit on
 * next sign-in.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  return async function handleSignOut() {
    await queryClient.cancelQueries();
    await signOut();
  };
}
