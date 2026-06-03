import { useCallback, useSyncExternalStore } from "react";

/**
 * The app renders one of three structurally different shells (a bespoke
 * agent-only phone app, a tablet icon-rail + master-detail layout, and the
 * desktop sidebar tree). They can't be CSS-toggled — that would mount all three
 * at once and multi-fire every TanStack query. So we pick the active tier in JS
 * and render exactly one shell.
 */
export type LayoutTier = "mobile" | "tablet" | "desktop";

/**
 * Width thresholds (px). These intentionally equal Tailwind's `md` (768) and
 * `xl` (1280) defaults, so CSS reflow utilities and JS tier selection stay in
 * lock-step with no custom `--breakpoint-*` needed.
 *
 * `DESKTOP_MIN = 1280` cleanly separates the two devices the design handoff
 * names: iPad-landscape (1194 → tablet icon rail) and laptop (1280 → desktop
 * sidebar). Trade-off: 1024–1279px small/old laptops get the tablet icon rail.
 * Flip `DESKTOP_MIN` to 1024 to give those the full sidebar instead (at the
 * cost of iPad-landscape then getting the sidebar).
 */
export const TABLET_MIN = 768;
export const DESKTOP_MIN = 1280;

/**
 * Subscribe to a CSS media query. Built on `useSyncExternalStore` so the first
 * paint reads the real match synchronously (no flash of the wrong shell). This
 * is a Vite SPA, so the server snapshot is never used in production — it returns
 * `false` purely to satisfy the API and keep tests deterministic.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = () =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false;

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** The active layout tier for the current viewport width. */
export function useLayoutTier(): LayoutTier {
  const atLeastTablet = useMediaQuery(`(min-width: ${TABLET_MIN}px)`);
  const atLeastDesktop = useMediaQuery(`(min-width: ${DESKTOP_MIN}px)`);
  if (atLeastDesktop) return "desktop";
  if (atLeastTablet) return "tablet";
  return "mobile";
}
