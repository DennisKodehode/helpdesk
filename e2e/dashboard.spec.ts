import { expect, test } from "@playwright/test";
import { AGENT_EMAIL, AGENT_PASSWORD, loginAs } from "./helpers/auth";

// ---------------------------------------------------------------------------
// Dashboard smoke test
//
// Verifies that the rebuilt dashboard page renders all its major sections for
// a logged-in agent. The test DB is seeded with an admin + one agent but zero
// tickets, so every card is in its empty/zero state — that is fine, because
// the goal is to confirm the page structure renders, not specific data values.
// ---------------------------------------------------------------------------

test.describe("Dashboard — smoke test", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    // loginAs already waits for URL "/" — assert the landmark before
    // interacting so Playwright's auto-wait has a stable target.
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Page header
  // -------------------------------------------------------------------------

  test("page header shows 'Dashboard' heading and 'Open queue' link", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();

    // The header action link navigates to the ticket queue.
    await expect(page.getByRole("link", { name: "Open queue" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Four stat cards
  // -------------------------------------------------------------------------

  test("four stat cards are visible with their labels", async ({ page }) => {
    // Each card is a link whose aria-label starts with the card name.
    // getByRole("link") with a regex lets us match regardless of the count.
    await expect(page.getByRole("link", { name: /^Open:/i })).toBeVisible();

    await expect(page.getByRole("link", { name: /^Needs triage:/i })).toBeVisible();

    await expect(page.getByRole("link", { name: /^SLA breached:/i })).toBeVisible();

    await expect(page.getByRole("link", { name: /^Resolved · 7d:/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // AI this week section
  // -------------------------------------------------------------------------

  test("'AI this week' section is visible", async ({ page }) => {
    // AiThisWeekCard renders the heading as a <p> (not an h2), labelled with
    // the text "AI this week".
    await expect(page.getByText("AI this week")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Recent activity section
  // -------------------------------------------------------------------------

  test("'Recent activity' section heading is visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Needs attention section
  // -------------------------------------------------------------------------

  test("'Needs attention' section heading is visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Open by category section
  // -------------------------------------------------------------------------

  test("'Open by category' section heading is visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Open by category" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // SLA compliance · 30d section
  // -------------------------------------------------------------------------

  test("'SLA compliance · 30d' section heading is visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "SLA compliance · 30d" }),
    ).toBeVisible();
  });
});
