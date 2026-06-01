import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";

// --- Config (env-overridable; dev defaults) -------------------------------
const APP = process.env.FIDELITY_APP_URL ?? "http://localhost:5173";
const PROTO = process.env.FIDELITY_PROTO_URL ?? "http://localhost:8099";
const EMAIL = process.env.FIDELITY_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.FIDELITY_PASSWORD ?? "password123";
const OUT = "tools/fidelity/.out";

// The prototype shells clamp the body to 100vh (overflow:hidden) — so the true
// content height lives on an inner wrapper, not document.body. Measure that so
// the Δ vs the app is meaningful. `.fade-in` is the prototypes' page wrapper;
// override if a handoff differs.
const PROTO_CONTENT_SELECTOR = process.env.FIDELITY_PROTO_CONTENT_SELECTOR ?? ".fade-in";

// Viewports to capture. 1440x1024 is a clean desktop reference; the 980-wide
// row catches the scaled-Windows band (~900–1024px CSS) where collapsing grids
// blow up page height — keep it in the list when auditing new screens.
const VIEWPORTS = [
  { width: 1440, height: 1024 },
  { width: 980, height: 1024 },
];

// EDIT PER REDESIGN: [prototype route, app path, screenshot name].
// The prototypes select a screen via a localStorage key (default "hd_route").
// If a future handoff routes differently (URL hash, etc.), adjust the prototype
// navigation block below.
const ROUTES: Array<[proto: string, app: string, name: string]> = [
  ["dashboard", "/", "dashboard"],
  ["tickets", "/tickets", "tickets"],
  ["mystats", "/my-stats", "mystats"],
];
const PROTO_ROUTE_KEY = process.env.FIDELITY_PROTO_ROUTE_KEY ?? "hd_route";

mkdirSync(OUT, { recursive: true });

for (const vp of VIEWPORTS) {
  test(`fidelity @ ${vp.width}x${vp.height}`, async ({ browser }) => {
    const report: string[] = [];

    for (const [protoRoute, appPath, name] of ROUTES) {
      const tag = `${name}@${vp.width}`;

      // Prototype — fresh context; the chosen screen lives in localStorage.
      const pctx = await browser.newContext({ viewport: vp });
      const pp = await pctx.newPage();
      await pp.addInitScript(([key, route]) => localStorage.setItem(key, route), [
        PROTO_ROUTE_KEY,
        protoRoute,
      ] as const);
      await pp.goto(PROTO);
      await pp.waitForTimeout(2000);
      const protoH = await pp.evaluate((sel) => {
        const el = document.querySelector(sel) ?? document.body;
        return (el as HTMLElement).scrollHeight;
      }, PROTO_CONTENT_SELECTOR);
      await pp.screenshot({ path: join(OUT, `proto-${tag}.png`), fullPage: true });
      await pctx.close();

      // App — log in, then navigate to the matching route.
      const mctx = await browser.newContext({ viewport: vp });
      const mp = await mctx.newPage();
      await mp.goto(`${APP}/login`);
      await mp.waitForTimeout(800);
      await mp.getByLabel("Email").fill(EMAIL);
      await mp.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await mp.getByRole("button", { name: "Sign in" }).click();
      await mp.waitForURL(`${APP}/`);
      await mp.goto(APP + appPath);
      await mp.waitForTimeout(2000);
      const mineH = await mp.evaluate(() => document.documentElement.scrollHeight);
      await mp.screenshot({ path: join(OUT, `mine-${tag}.png`), fullPage: true });
      await mctx.close();

      report.push(
        `  ${name.padEnd(12)} proto=${protoH}px  mine=${mineH}px  Δ=${mineH - protoH}px`,
      );
    }

    console.log(`\n=== fidelity height report @ ${vp.width}x${vp.height} ===`);
    for (const line of report) console.log(line);
    console.log(`  screenshots → ${OUT}/{proto,mine}-*@${vp.width}.png\n`);
  });
}
