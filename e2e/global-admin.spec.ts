import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAs } from "./helpers/auth";

// ===========================================================================
// Helpers
// ===========================================================================

const SEED_USER_URL = "http://localhost:3000/api/test/seed-user";
const DELETE_USER_URL = "http://localhost:3000/api/test/delete-user";

// A regular (non-global) admin seeded by these tests. Distinct email addresses
// per suite so the two describe blocks can run without racing on the same row.
const GLOBAL_ADMIN_SUITE = {
  admin: {
    name: "Regular Admin (GA Suite)",
    email: "e2e-ga-suite-admin@example.com",
    password: "RegAdminPass1!",
    role: "admin",
  },
};

const REGULAR_ADMIN_SUITE = {
  admin: {
    name: "Regular Admin (RA Suite)",
    email: "e2e-ra-suite-admin@example.com",
    password: "RegAdminPass2!",
    role: "admin",
  },
  agent: {
    name: "Agent For RA Suite",
    email: "e2e-ra-suite-agent@example.com",
    password: "AgentForRA1!",
    role: "agent",
  },
};

// ===========================================================================
// 1. Global admin (seeded owner) on /users
//
// The seeded owner (ADMIN_EMAIL) is the global admin. On /users they should
// see the full roster controls: an invite dialog with an Admin role option, an
// interactive "Change role" button on regular-admin rows, and a kebab "Agent
// actions" menu on regular-admin rows. Their OWN row is always locked.
// ===========================================================================

test.describe
  .serial("Global admin — /users roster controls", () => {
    test.beforeAll(async ({ request }) => {
      const res = await request.post(SEED_USER_URL, {
        data: GLOBAL_ADMIN_SUITE.admin,
      });
      expect(res.status()).toBe(201);
    });

    test.afterAll(async ({ request }) => {
      await request.post(DELETE_USER_URL, {
        data: { email: GLOBAL_ADMIN_SUITE.admin.email },
      });
    });

    test("invite dialog shows the Role picker with Agent and Admin options", async ({
      page,
    }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      // Open the invite dialog.
      await page.getByRole("button", { name: "Invite agent" }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Invite an agent" }),
      ).toBeVisible();

      // The Role picker fieldset is visible — the global admin can invite admins.
      // The fieldset contains visually-hidden radio inputs wrapped in <label>
      // elements. We locate by the label text inside the fieldset.
      const fieldset = dialog.locator("fieldset");
      await expect(fieldset).toBeVisible();
      // Both role options are present as label text inside the fieldset.
      await expect(fieldset.getByText("Agent", { exact: true })).toBeVisible();
      await expect(fieldset.getByText("Admin", { exact: true })).toBeVisible();

      // Close without submitting.
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).not.toBeVisible();
    });

    test("regular admin row has an interactive 'Change role' button for the global admin", async ({
      page,
    }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      const adminRow = page
        .getByRole("row")
        .filter({ hasText: GLOBAL_ADMIN_SUITE.admin.email });
      await expect(adminRow).toBeVisible();

      // The global admin can change a regular admin's role — the trigger is a
      // button, not a static span.
      await expect(adminRow.getByRole("button", { name: "Change role" })).toBeVisible();
    });

    test("regular admin row has an 'Agent actions' kebab menu for the global admin", async ({
      page,
    }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      const adminRow = page
        .getByRole("row")
        .filter({ hasText: GLOBAL_ADMIN_SUITE.admin.email });
      await expect(adminRow).toBeVisible();

      // The global admin can perform row actions on a regular admin row.
      await expect(adminRow.getByRole("button", { name: "Agent actions" })).toBeVisible();
    });

    test("global admin's OWN row shows a read-only 'Global admin' badge and no controls", async ({
      page,
    }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      const ownerRow = page.getByRole("row").filter({ hasText: ADMIN_EMAIL });
      await expect(ownerRow).toBeVisible();

      // The owner row badge is a read-only <span> — no interactive "Change role".
      await expect(
        ownerRow.getByRole("button", { name: "Change role" }),
      ).not.toBeVisible();

      // No "Agent actions" kebab on the owner row.
      await expect(
        ownerRow.getByRole("button", { name: "Agent actions" }),
      ).not.toBeVisible();

      // The role badge text reads "Global admin" (ROLE_LABEL in ticket-ui.ts).
      await expect(ownerRow.getByText("Global admin")).toBeVisible();
    });
  });

// ===========================================================================
// 2. Regular admin on /users
//
// A regular admin has limited roster powers: they can manage agents but NOT
// admins. Their invite dialog must NOT show the Role picker. Admin and
// global-admin rows must have read-only role badges and no kebab menus. Agent
// rows remain fully manageable (actions present).
// ===========================================================================

test.describe
  .serial("Regular admin — limited /users roster controls", () => {
    test.beforeAll(async ({ request }) => {
      // Seed the regular admin and a test agent independently (distinct emails
      // from suite 1 to avoid cross-suite races).
      const adminRes = await request.post(SEED_USER_URL, {
        data: REGULAR_ADMIN_SUITE.admin,
      });
      expect(adminRes.status()).toBe(201);

      const agentRes = await request.post(SEED_USER_URL, {
        data: REGULAR_ADMIN_SUITE.agent,
      });
      expect(agentRes.status()).toBe(201);
    });

    test.afterAll(async ({ request }) => {
      await request.post(DELETE_USER_URL, {
        data: { email: REGULAR_ADMIN_SUITE.admin.email },
      });
      await request.post(DELETE_USER_URL, {
        data: { email: REGULAR_ADMIN_SUITE.agent.email },
      });
    });

    test("regular admin's invite dialog has NO Role picker — agent-only invite", async ({
      page,
    }) => {
      await loginAs(
        page,
        REGULAR_ADMIN_SUITE.admin.email,
        REGULAR_ADMIN_SUITE.admin.password,
      );
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      await page.getByRole("button", { name: "Invite agent" }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Invite an agent" }),
      ).toBeVisible();

      // The Role fieldset must NOT be present — regular admins cannot invite admins.
      await expect(dialog.locator("fieldset")).not.toBeVisible();

      // The dialog only shows name + email fields.
      await expect(dialog.getByLabel("Full name")).toBeVisible();
      await expect(dialog.getByLabel("Work email")).toBeVisible();

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).not.toBeVisible();
    });

    test("regular admin sees a read-only badge on the global admin's row (no 'Change role')", async ({
      page,
    }) => {
      await loginAs(
        page,
        REGULAR_ADMIN_SUITE.admin.email,
        REGULAR_ADMIN_SUITE.admin.password,
      );
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      // The seeded global admin row must have a read-only badge.
      const ownerRow = page.getByRole("row").filter({ hasText: ADMIN_EMAIL });
      await expect(ownerRow).toBeVisible();
      await expect(
        ownerRow.getByRole("button", { name: "Change role" }),
      ).not.toBeVisible();
      await expect(ownerRow.getByText("Global admin")).toBeVisible();
    });

    test("regular admin sees no 'Agent actions' menu on the global-admin row", async ({
      page,
    }) => {
      await loginAs(
        page,
        REGULAR_ADMIN_SUITE.admin.email,
        REGULAR_ADMIN_SUITE.admin.password,
      );
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      // Global admin row — no actions menu.
      const ownerRow = page.getByRole("row").filter({ hasText: ADMIN_EMAIL });
      await expect(ownerRow).toBeVisible();
      await expect(
        ownerRow.getByRole("button", { name: "Agent actions" }),
      ).not.toBeVisible();
    });

    test("regular admin can deactivate an agent via the 'Agent actions' menu", async ({
      page,
    }) => {
      await loginAs(
        page,
        REGULAR_ADMIN_SUITE.admin.email,
        REGULAR_ADMIN_SUITE.admin.password,
      );
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      const agentRow = page
        .getByRole("row")
        .filter({ hasText: REGULAR_ADMIN_SUITE.agent.email });
      await expect(agentRow).toBeVisible();

      // Agent rows are fully manageable by any admin.
      await agentRow.getByRole("button", { name: "Agent actions" }).click();
      await page.getByRole("menuitem", { name: "Deactivate" }).click();

      // Status pill flips to Inactive.
      await expect(agentRow.getByText("Inactive")).toBeVisible();
    });
  });
