import { vi } from "vitest";

/**
 * jsdom ships no `window.matchMedia`, so the responsive layout hook
 * (`useLayoutTier`) would throw under tests. This installs a controllable mock:
 * `setTestViewportWidth(px)` updates the simulated width and dispatches `change`
 * events to every live query, exactly like a real resize. `min-width` /
 * `max-width` queries are evaluated against the current width.
 */

type Listener = (e: { matches: boolean; media: string }) => void;

interface MockMediaQueryList {
  media: string;
  matches: boolean;
  onchange: null;
  _listeners: Set<Listener>;
  addEventListener: (type: string, l: Listener) => void;
  removeEventListener: (type: string, l: Listener) => void;
  addListener: (l: Listener) => void;
  removeListener: (l: Listener) => void;
  dispatchEvent: () => boolean;
}

const DEFAULT_WIDTH = 1280; // desktop, matching the app's default tier in tests
let currentWidth = DEFAULT_WIDTH;
const cache = new Map<string, MockMediaQueryList>();

function evaluate(media: string): boolean {
  const min = media.match(/min-width:\s*(\d+)px/);
  if (min) return currentWidth >= Number(min[1]);
  const max = media.match(/max-width:\s*(\d+)px/);
  if (max) return currentWidth <= Number(max[1]);
  return false;
}

function createMql(query: string): MockMediaQueryList {
  const mql: MockMediaQueryList = {
    media: query,
    matches: evaluate(query),
    onchange: null,
    _listeners: new Set(),
    addEventListener: (_type, l) => {
      mql._listeners.add(l);
    },
    removeEventListener: (_type, l) => {
      mql._listeners.delete(l);
    },
    addListener: (l) => {
      mql._listeners.add(l);
    },
    removeListener: (l) => {
      mql._listeners.delete(l);
    },
    dispatchEvent: () => true,
  };
  return mql;
}

export function installMatchMediaMock(): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => {
      let mql = cache.get(query);
      if (!mql) {
        mql = createMql(query);
        cache.set(query, mql);
      }
      return mql as unknown as MediaQueryList;
    }),
  });
}

/** Simulate a viewport resize: update width and notify all live queries. */
export function setTestViewportWidth(px: number): void {
  currentWidth = px;
  for (const mql of cache.values()) {
    const next = evaluate(mql.media);
    if (next !== mql.matches) {
      mql.matches = next;
      for (const l of mql._listeners) l({ matches: next, media: mql.media });
    }
  }
}

/** Reset width to the desktop default and drop cached queries (per-test). */
export function resetTestViewport(): void {
  currentWidth = DEFAULT_WIDTH;
  cache.clear();
}
