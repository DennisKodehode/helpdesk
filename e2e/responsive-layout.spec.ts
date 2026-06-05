import { type APIRequestContext, expect, test } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
  loginAs,
} from "./helpers/auth";

// ---------------------------------------------------------------------------
// Seed helper — reused from ticket-detail.spec.ts pattern
// ---------------------------------------------------------------------------

const SEED_TICKET_URL = "http://localhost:3000/api/test/seed-ticket";

async function createTestTicket(
  request: APIRequestContext,
  overrides: Partial<{
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    status: string;
  }> = {},
): Promise<{ id: number; subject: string }> {
  const response = await request.post(SEED_TICKET_URL, {
    data: {
      fromName: overrides.fromName ?? "Layout Tester",
      fromEmail: overrides.fromEmail ?? "layout@example.com",
      subject: overrides.subject ?? "Responsive layout test ticket",
      body: overrides.body ?? "Testing the responsive layout.",
      ...(overrides.status ? { status: overrides.status } : {}),
    },
    headers: { "content-type": "application/json" },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to seed test ticket: ${response.status()} ${await response.text()}`,
    );
  }

  return (await response.json()) as { id: number; subject: string };
}

// ===========================================================================
// 1. Mobile agent flow (390×844 — iPhone 14 equivalent)
//
// The phone build renders a fixed bottom tab bar (Home / Tickets / Mine /
// Stats) and a top brand bar with a bell button. Ticket detail is full-screen
// with a "Back" button — the shell steps aside (no tab bar visible) while a
// detail route is active.
// ===========================================================================

test.describe("Mobile agent flow", () => {
  // Apply the mobile viewport for every test in this block.
  test.use({ viewport: { width: 390, height: 844 } });

  let ticketId: number;
  let ticketSubject: string;

  test.beforeAll(async ({ request }) => {
    const ticket = await createTestTicket(request, {
      fromEmail: "mobile-agent@example.com",
      fromName: "Mobile Tester",
      subject: "Mobile layout test ticket",
      body: "This ticket is used to verify the mobile detail view.",
    });
    ticketId = ticket.id;
    ticketSubject = ticket.subject;
  });

  test("agent lands on the dashboard after login", async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

    // MobileDashboard renders an h1 via MobileHead.
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });

  test("bottom tab bar is visible on tab screens (Home, Tickets, Mine, Stats)", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

    // The tab bar nav has aria-label="Primary" (MobileTabBar).
    const tabBar = page.getByRole("navigation", { name: "Primary" });
    await expect(tabBar).toBeVisible();

    // All four agent tabs are present.
    await expect(tabBar.getByText("Home")).toBeVisible();
    await expect(tabBar.getByText("Tickets")).toBeVisible();
    await expect(tabBar.getByText("Mine")).toBeVisible();
    await expect(tabBar.getByText("Stats")).toBeVisible();
  });

  test("tapping the Tickets tab navigates to /tickets and shows the ticket list", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

    // Tap the Tickets tab in the bottom bar.
    const tabBar = page.getByRole("navigation", { name: "Primary" });
    await tabBar.getByText("Tickets").click();
    await page.waitForURL("/tickets");

    // MobileTicketsList renders an h1 via MobileHead.
    await expect(page.getByRole("heading", { level: 1, name: "Tickets" })).toBeVisible();

    // The tab bar must still be present on a tab screen.
    await expect(tabBar).toBeVisible();
  });

  test("tapping a ticket card opens full-screen detail with a Back button", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/tickets");

    // Use getByRole with the full button name to avoid strict-mode violations
    // when multiple tickets share the same subject (parallel test seeding).
    // The mobile ticket card renders a button whose accessible name is built
    // from subject + case number + sender + status.
    const ticketButton = page
      .getByRole("button")
      .filter({ hasText: ticketSubject })
      .filter({ hasText: `#${String(ticketId).padStart(4, "0")}` });
    await ticketButton.click();

    // URL changes to the ticket detail route.
    await page.waitForURL(`/tickets/${ticketId}`);

    // MobileTicketDetail renders a header with aria-label="Back" for the back
    // button (MobileTicketDetail.tsx).
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

    // The bottom tab bar is hidden on detail routes (MobileShell steps aside).
    await expect(page.getByRole("navigation", { name: "Primary" })).not.toBeVisible();
  });

  test("Back button on ticket detail returns to the tickets list", async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

    // Navigate via /tickets so the router history stack has an entry — then
    // click into the seeded ticket so that navigate(-1) goes back to /tickets
    // (not to some unrelated page). Direct page.goto(detail) would leave the
    // history stack empty and navigate(-1) would go to "/" instead.
    await page.goto("/tickets");
    await page
      .getByRole("button")
      .filter({ hasText: ticketSubject })
      .filter({ hasText: `#${String(ticketId).padStart(4, "0")}` })
      .click();
    await page.waitForURL(`/tickets/${ticketId}`);

    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    // navigate(-1) goes back to /tickets (the list).
    await page.waitForURL("/tickets");
    await expect(page.getByRole("heading", { level: 1, name: "Tickets" })).toBeVisible();
  });

  test("bell button opens the notification sheet and Close button closes it", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

    // The bell button's aria-label is dynamic ("Notifications" or
    // "Notifications (N unread)") — match the prefix.
    const bellButton = page.getByRole("button", { name: /Notifications/ });
    await expect(bellButton).toBeVisible();
    await bellButton.click();

    // The sheet dialog has a title "Notifications" (DialogPrimitive.Title).
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    // The sheet renders "Notifications" in both an h2 (DialogPrimitive.Title)
    // and an eyebrow <p>. Use getByRole("heading") to target the title element
    // and avoid the strict-mode violation that getByText would cause.
    await expect(sheet.getByRole("heading", { name: "Notifications" })).toBeVisible();

    // Close button (aria-label="Close") dismisses the sheet.
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).not.toBeVisible();
  });
});

// ===========================================================================
// 2. Mobile — admin is redirected (agent-only phone build)
//
// AdminLayout redirects to "/" on the mobile tier instead of rendering admin
// content. The bottom tab bar must NOT include Agents / Workflow / Activity.
// ===========================================================================

test.describe("Mobile admin restrictions", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("admin bottom tab bar shows only agent tabs (no Agents/Workflow/Activity)", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const tabBar = page.getByRole("navigation", { name: "Primary" });
    await expect(tabBar).toBeVisible();

    // The four agent tabs exist.
    await expect(tabBar.getByText("Home")).toBeVisible();
    await expect(tabBar.getByText("Tickets")).toBeVisible();

    // Admin-only items must NOT appear in the bottom tab bar.
    await expect(tabBar.getByText("Agents")).not.toBeVisible();
    await expect(tabBar.getByText("Workflow")).not.toBeVisible();
    await expect(tabBar.getByText("Activity")).not.toBeVisible();
  });

  test("admin navigating directly to /workflow on mobile is redirected to /", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // AdminLayout detects the mobile tier and immediately redirects.
    await page.goto("/workflow");
    await page.waitForURL("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });

  test("admin navigating directly to /users on mobile is redirected to /", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto("/users");
    await page.waitForURL("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });

  test("admin navigating directly to /activity on mobile is redirected to /", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto("/activity");
    await page.waitForURL("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });
});

// ===========================================================================
// 3. Tablet master-detail layout (1024×1366 — iPad Pro portrait)
//
// The tablet tier renders a 76px icon rail (TabletIconRail) beside a
// two-pane master-detail on /tickets. Bare /tickets shows "Select a ticket";
// clicking a ticket card navigates to /tickets/:id, at which point the detail
// pane renders the ticket.
// ===========================================================================

test.describe("Tablet master-detail layout", () => {
  test.use({ viewport: { width: 1024, height: 1366 } });

  let ticketId: number;
  let ticketSubject: string;

  test.beforeAll(async ({ request }) => {
    const ticket = await createTestTicket(request, {
      fromEmail: "tablet-test@example.com",
      fromName: "Tablet Tester",
      subject: "Tablet layout test ticket",
      body: "This ticket is used to verify the tablet master-detail view.",
    });
    ticketId = ticket.id;
    ticketSubject = ticket.subject;
  });

  test("tablet /tickets shows the 76px icon rail with accessible nav links", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/tickets");

    // The icon rail nav items use aria-label (TabletRailItem). Verify the
    // primary nav items are present as links with the correct accessible names.
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    // Use exact: true so "Tickets" doesn't also match the "My tickets" link.
    await expect(page.getByRole("link", { name: "Tickets", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "My tickets" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My stats" })).toBeVisible();

    // The desktop sidebar text-links ("Dashboard", "Tickets" as visible text in
    // a 256px sidebar) must NOT be present — the tablet icon rail renders only
    // icon + aria-label, no visible label text.
    // We verify the sidebar is absent by checking that there is no <aside> with
    // the fixed 256px sidebar class. Instead, the icon rail <aside> has w-[76px].
    // We can confirm the icon rail itself is exactly 76px wide by checking the
    // bounding box of the aside element.
    const rail = page.locator("aside").first();
    const box = await rail.boundingBox();
    expect(box?.width).toBe(76);
  });

  test("tablet /tickets shows the 'Select a ticket' empty state in the detail pane", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/tickets");

    // When no ticket is selected the detail pane shows this empty state
    // (TabletTicketsMasterDetail.tsx).
    await expect(page.getByText("Select a ticket")).toBeVisible();
    await expect(
      page.getByText("Pick a conversation from the queue to view it here."),
    ).toBeVisible();
  });

  test("clicking a ticket card in the list pane navigates to /tickets/:id and renders the detail pane", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/tickets");

    // Wait for the list pane to finish loading. Use a compound filter to
    // uniquely identify the seeded ticket by both subject AND case number —
    // parallel test seeding can produce multiple tickets with the same subject,
    // which would cause a strict-mode violation on a plain name match.
    await page
      .getByRole("button")
      .filter({ hasText: ticketSubject })
      .filter({ hasText: `#${String(ticketId).padStart(4, "0")}` })
      .click();

    // TicketsPage calls navigate(`/tickets/${id}`) on selection (TicketsPage.tsx).
    await page.waitForURL(`/tickets/${ticketId}`);

    // "Select a ticket" placeholder is gone.
    await expect(page.getByText("Select a ticket")).not.toBeVisible();

    // The detail pane loads the ticket. TicketDetails renders the subject as an
    // h1 (same component used on desktop).
    await expect(
      page.getByRole("heading", { level: 1, name: ticketSubject }),
    ).toBeVisible();

    // The icon rail is still present alongside the detail.
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("admin icon rail includes Agents/Workflow/Activity links on tablet", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/");

    // ADMIN_NAV items appear below a divider in the tablet icon rail.
    await expect(page.getByRole("link", { name: "Agents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Workflow" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Activity" })).toBeVisible();
  });
});

// ===========================================================================
// 4. Desktop layout — 256px sidebar unchanged (1440×900)
//
// At >=1280px the DesktopShell renders the full Sidebar with visible text
// links. This confirms the desktop tier is still active and unaffected by the
// responsive redesign.
// ===========================================================================

test.describe("Desktop layout — sidebar unchanged", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("desktop renders the full sidebar with visible Dashboard and Tickets links", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

    // The desktop sidebar renders SidebarLink items with visible text
    // (Sidebar.tsx). These are <a> elements with visible label text, unlike the
    // tablet icon rail which uses aria-label only.
    // exact: true prevents "Tickets" from also matching the "My tickets" link.
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tickets", exact: true })).toBeVisible();
  });

  test("desktop sidebar link text 'Helpdesk' brand is visible", async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

    // The sidebar brand is a link to "/" with visible text "Helpdesk" (the
    // italic period is aria-hidden). The tablet icon rail shows only "H." (aria-
    // label="Helpdesk"), not the full word.
    await expect(page.getByRole("link", { name: "Helpdesk" }).first()).toBeVisible();
  });

  test("desktop shows the 256px sidebar (not the 76px icon rail)", async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

    // Wait for the sidebar to be rendered before measuring; loginAs only waits
    // for URL "/" which may resolve before the layout is fully painted.
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();

    // The desktop sidebar <aside> is fixed at w-64 = 256px.
    const box = await sidebar.boundingBox();
    expect(box?.width).toBe(256);
  });

  test("admin can navigate to /users via the sidebar Administration links", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // The sidebar renders admin links with visible text under "Administration".
    await page.getByRole("link", { name: "Agents" }).click();
    await page.waitForURL("/users");

    await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
  });

  test("desktop /tickets shows the full queue table (not the tablet master-detail)", async ({
    page,
  }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/tickets");

    // The desktop queue renders a PageHeader with title "Tickets" (TicketsQueue).
    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();

    // The tablet "Select a ticket" placeholder must NOT appear.
    await expect(page.getByText("Select a ticket")).not.toBeVisible();
  });
});
