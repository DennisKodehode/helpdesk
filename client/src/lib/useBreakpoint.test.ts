import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setTestViewportWidth } from "../test/matchMedia";
import { DESKTOP_MIN, TABLET_MIN, useLayoutTier, useMediaQuery } from "./useBreakpoint";

afterEach(() => {
  // resetTestViewport runs globally in setup.ts; nothing extra needed here.
});

describe("useMediaQuery", () => {
  it("reflects the current viewport against a min-width query", () => {
    setTestViewportWidth(500);
    const { result, rerender } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);

    act(() => setTestViewportWidth(900));
    rerender();
    expect(result.current).toBe(true);
  });
});

describe("useLayoutTier", () => {
  it("returns 'mobile' below the tablet threshold", () => {
    setTestViewportWidth(TABLET_MIN - 1);
    const { result } = renderHook(() => useLayoutTier());
    expect(result.current).toBe("mobile");
  });

  it("returns 'tablet' between the tablet and desktop thresholds", () => {
    setTestViewportWidth(TABLET_MIN);
    const { result } = renderHook(() => useLayoutTier());
    expect(result.current).toBe("tablet");
  });

  it("returns 'tablet' at iPad-landscape width (1194)", () => {
    setTestViewportWidth(1194);
    const { result } = renderHook(() => useLayoutTier());
    expect(result.current).toBe("tablet");
  });

  it("returns 'desktop' at and above the desktop threshold", () => {
    setTestViewportWidth(DESKTOP_MIN);
    const { result } = renderHook(() => useLayoutTier());
    expect(result.current).toBe("desktop");
  });

  it("transitions across tiers on resize", () => {
    setTestViewportWidth(1400);
    const { result } = renderHook(() => useLayoutTier());
    expect(result.current).toBe("desktop");

    act(() => setTestViewportWidth(1000));
    expect(result.current).toBe("tablet");

    act(() => setTestViewportWidth(400));
    expect(result.current).toBe("mobile");
  });
});
