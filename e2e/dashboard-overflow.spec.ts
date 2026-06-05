import { type APIRequestContext, expect, test } from "@playwright/test";
import { AGENT_EMAIL, AGENT_PASSWORD, loginAs } from "./helpers/auth";

// ---------------------------------------------------------------------------
// Regression: dashboard horizontal overflow at tablet width
//
// Bug: the Row 2 two-column grid used bare `fr` tracks
// (`md:grid-cols-[1.55fr_1fr]`). A bare `fr` track is `minmax(auto, …)`, so
// its minimum size equals its content's min-content width. The `truncate`
// (white-space: nowrap) subjects in NeedsAttentionCard and RecentActivityCard
// made min-content equal the full single-line width, so the grid tracks refused
// to shrink and the whole page overflowed horizontally at ~910px.
//
// Fix: tracks changed to `md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]` so
// columns can shrink and subjects truncate instead of overflowing.
//
// This test guards against regression by:
//  1. Using a 910×800 viewport (tablet tier, where the bug reproduced)
//  2. Seeding an urgent ticket backdated 24 hours (well past the 60-min first-
//     response SLA) with a 100-char subject so it appears in "Needs attention"
//  3. Asserting the rendered bounding boxes of both dashboard regions do not
//     extend past the 910px viewport width.
//
// NOTE: document.documentElement.scrollWidth is intentionally NOT used for the
// core assertion. At 910px the app renders inside TabletShell, whose outer
// wrapper is `flex h-screen overflow-hidden` and whose <main> is
// `overflow-y-auto` (which makes overflow-x compute to `auto`). That scroll
// container absorbs the horizontal overflow before it can propagate to
// documentElement, so scrollWidth stays pinned at the viewport width even on a
// broken layout. Bounding-box checks report true rendered position regardless of
// ancestor clipping and therefore catch the real regression.
// ---------------------------------------------------------------------------

const SEED_TICKET_URL = "http://localhost:3000/api/test/seed-ticket";

const LONG_SUBJECT =
  "Customer unable to complete purchase due to persistent checkout validation error blocking all payment methods";

async function seedBreachedTicket(request: APIRequestContext): Promise<{ id: number }> {
  // Backdate by 24 hours — the seeded urgent SLA first-response target is
  // 60 minutes (1 hour), so a 24-hour-old ticket is solidly breached and
  // will appear in the "Needs attention" card.
  //
  // Using 24h (not 2h) guards against cross-spec interference: the
  // "SLA targets — save and revert" block in admin-features.spec.ts
  // temporarily raises the urgent first-response SLA to 3 hours (180 min).
  // A 2-hour backdate would fall below that threshold, making the ticket
  // switch to `ok` state and vanish from "Needs attention" while the other
  // spec is mid-run. 24h stays solidly breached regardless of any SLA edit
  // another parallel worker may be applying simultaneously.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const response = await request.post(SEED_TICKET_URL, {
    data: {
      fromName: "Overflow Test Customer",
      fromEmail: "overflow-test@example.com",
      subject: LONG_SUBJECT,
      body: "Unable to complete purchase. Checkout keeps failing.",
      status: "open",
      priority: "urgent",
      createdAt: oneDayAgo,
    },
    headers: { "content-type": "application/json" },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to seed breached ticket: ${response.status()} ${await response.text()}`,
    );
  }

  return (await response.json()) as { id: number };
}

// ---------------------------------------------------------------------------
// Overflow regression suite
// ---------------------------------------------------------------------------

// serial: both tests share the beforeAll seed — prevents parallel workers from
// each seeding the ticket independently and producing duplicate subjects on the
// same page, which would trigger strict mode violations in the locators.
test.describe
  .serial("Dashboard horizontal overflow (tablet 910px)", () => {
    // Apply the tablet viewport BEFORE any navigation so `useLayoutTier`
    // (`useSyncExternalStore` + `window.matchMedia`) reads the correct width on
    // first paint. 910px is squarely in the 768–1279 range that renders
    // DashboardView (the two-column grid), not MobileDashboard.
    test.use({ viewport: { width: 910, height: 800 } });

    test.beforeAll(async ({ request }) => {
      await seedBreachedTicket(request);
    });

    test("dashboard does not overflow horizontally at tablet width with long ticket subjects", async ({
      page,
    }) => {
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

      // loginAs already waits for URL "/" — confirm DashboardView mounted (not
      // MobileDashboard) by asserting the two-column grid's sections are present.
      await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();

      // Wait for the Needs attention card to finish loading its data. Scope the
      // subject lookup to the card's section so strict mode is satisfied even if
      // the same subject appears elsewhere on the page. The long subject must
      // appear in the card — if it does not, the bounding-box assertion would
      // silently pass even on a broken build (no wide content = no overflow).
      // Allow extra time when the full suite runs in parallel — the server may
      // be under load from concurrent workers, slowing the API response.
      const needsAttentionSection = page.getByRole("region", {
        name: "Needs attention",
      });
      await expect(needsAttentionSection.getByText(LONG_SUBJECT).first()).toBeVisible({
        timeout: 15_000,
      });

      // Core overflow assertion: measure the rendered bounding boxes of both
      // dashboard regions. Both NeedsAttentionCard and RecentActivityCard render
      // as <section aria-labelledby=…> (ARIA role "region"). We check both so the
      // guard catches either column regressing — the right column (Needs attention)
      // is the one that historically overflowed, but the left can also regress.
      //
      // Bounding boxes report true layout position regardless of ancestor clipping,
      // so this catches overflow that document.documentElement.scrollWidth cannot
      // (TabletShell's overflow-hidden wrapper absorbs it before it reaches
      // documentElement). 1px tolerance for sub-pixel rounding across browsers/OS.
      const viewportWidth = 910;
      for (const name of ["Recent activity", "Needs attention"]) {
        const region = page.getByRole("region", { name });
        const box = await region.boundingBox();
        expect(box, `${name} region should be present`).not.toBeNull();
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewportWidth + 1);
      }
    });

    test("long subject in Needs attention card is clipped (truncated) within the card boundary", async ({
      page,
    }) => {
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

      // Wait for the long subject to render in the Needs attention card.
      const needsAttentionSection = page.getByRole("region", {
        name: "Needs attention",
      });
      await expect(needsAttentionSection.getByText(LONG_SUBJECT).first()).toBeVisible({
        timeout: 15_000,
      });

      // The subject link sits inside the NeedsAttentionCard. Get the bounding box
      // of the subject text element and confirm it does not extend past the card.
      const subjectLocator = page
        .getByRole("link", { name: new RegExp(LONG_SUBJECT.slice(0, 30)) })
        .first();

      await expect(subjectLocator).toBeVisible();

      const subjectBox = await subjectLocator.boundingBox();
      expect(subjectBox).not.toBeNull();

      // The subject link must fit within the 910px viewport (with some margin for
      // padding/scrollbar). If truncation is broken, the link would be wider than
      // the viewport.
      const viewportWidth = 910;
      expect((subjectBox?.x ?? 0) + (subjectBox?.width ?? 0)).toBeLessThanOrEqual(
        viewportWidth,
      );
    });
  });
