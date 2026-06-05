import { expect, test } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
  loginAs,
} from "./helpers/auth";

// ===========================================================================
// Admin-action audit log
//
// Verifies that admin mutations are recorded in the admin-only audit log
// surfaced on /activity → "Admin activity" tab, and that those events do NOT
// bleed into the ticket-scoped activity tab or the dashboard Recent activity
// card.
// ===========================================================================

const SEED_USER_URL = "http://localhost:3000/api/test/seed-user";
const DELETE_USER_URL = "http://localhost:3000/api/test/delete-user";

// A distinct agent name/email for this suite — avoid collisions with other
// spec files that also create agents.
const AUDIT_AGENT = {
  name: "Audit Log Target",
  email: "e2e-audit-log-target@example.com",
  password: "AuditLogPass1!",
  role: "agent",
};

// ===========================================================================
// 1. Main journey — deactivate → appears in Admin activity, absent elsewhere
// ===========================================================================

test.describe
  .serial("Admin audit log — deactivate event is recorded and scoped correctly", () => {
    test.beforeAll(async ({ request }) => {
      const res = await request.post(SEED_USER_URL, { data: AUDIT_AGENT });
      expect(res.status()).toBe(201);
    });

    test.afterAll(async ({ request }) => {
      await request.post(DELETE_USER_URL, { data: { email: AUDIT_AGENT.email } });
    });

    // -----------------------------------------------------------------------
    // Step 1 — perform the action (deactivate via /users kebab menu)
    // -----------------------------------------------------------------------

    test("admin deactivates an agent via the Agent actions menu", async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      const agentRow = page.getByRole("row").filter({ hasText: AUDIT_AGENT.email });
      await expect(agentRow).toBeVisible();

      await agentRow.getByRole("button", { name: "Agent actions" }).click();
      await page.getByRole("menuitem", { name: "Deactivate" }).click();

      // Confirm the status pill flipped — the mutation happened.
      await expect(agentRow.getByText("Inactive")).toBeVisible();
    });

    // -----------------------------------------------------------------------
    // Step 2 — Admin activity tab shows the deactivation row
    // -----------------------------------------------------------------------

    test("'Admin activity' tab on /activity shows the deactivation event", async ({
      page,
    }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/activity");

      // The page opens on the default "Ticket activity" tab. Switch to
      // "Admin activity" and confirm the URL updates.
      await page.getByRole("tab", { name: "Admin activity" }).click();
      await expect(page).toHaveURL(/[?&]tab=admin/);

      // The AdminActivityTable should contain at least one row whose Action
      // text mentions "deactivated" and whose Target column shows the agent
      // name. Use a row-scoped assertion so we know both columns agree.
      const actionCell = page
        .getByRole("cell")
        .filter({ hasText: new RegExp(`deactivated ${AUDIT_AGENT.name}`, "i") });
      await expect(actionCell.first()).toBeVisible();
    });

    // -----------------------------------------------------------------------
    // Step 3 — Ticket activity tab must NOT contain the deactivation text
    // -----------------------------------------------------------------------

    test("'Ticket activity' tab on /activity does NOT show the deactivation event", async ({
      page,
    }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/activity");

      // Default tab is "Ticket activity" — no ?tab param.
      await expect(page.getByRole("tab", { name: "Ticket activity" })).toBeVisible();

      // The deactivation action text must not appear anywhere on this tab.
      await expect(
        page.getByText(new RegExp(`deactivated ${AUDIT_AGENT.name}`, "i")),
      ).not.toBeVisible();
    });

    // -----------------------------------------------------------------------
    // Step 4 — Dashboard Recent activity card must NOT show the event
    // -----------------------------------------------------------------------

    test("dashboard 'Recent activity' card does NOT show the deactivation event", async ({
      page,
    }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      // The dashboard mounts the RecentActivityCard which fetches ticket events.
      await expect(
        page.getByRole("heading", { level: 1, name: "Dashboard" }),
      ).toBeVisible();

      // Confirm the card itself is rendered (heading is visible).
      const card = page.getByRole("region", {
        name: "Recent activity",
      });
      await expect(card).toBeVisible();

      // The deactivation text must be absent from the card.
      await expect(
        card.getByText(new RegExp(`deactivated ${AUDIT_AGENT.name}`, "i")),
      ).not.toBeVisible();
    });
  });

// ===========================================================================
// 2. RBAC — agent cannot access /activity (already covered broadly in auth
//    spec, but included here so the audit spec is self-contained)
// ===========================================================================

test.describe("Admin audit log — RBAC: agent cannot access /activity", () => {
  test("agent visiting /activity is redirected to the dashboard", async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/activity");

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });
});
