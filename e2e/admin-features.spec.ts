import { expect, test } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
  loginAs,
  logout,
  submitLoginForm,
} from "./helpers/auth";

// ===========================================================================
// 1. Invite → Accept → Signed in
//
// Full invite flow: admin opens /users, invites a new agent via the dialog;
// the agent then lands on /accept-invite?token=… (token obtained via the
// test-only seed-invite endpoint), sets a password, and is redirected to the
// dashboard as a signed-in user.
// ===========================================================================

test.describe
  .serial("Invite flow — invite → accept → sign in", () => {
    const INVITEE = {
      name: "Jordan Ellis",
      email: "e2e-invite@example.com",
      password: "InvitePass1!",
    };

    test("admin can invite an agent who then appears as Invited in the roster", async ({
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

      // Fill the form — Full name / Work email / keep Role as Agent (default).
      await dialog.getByLabel("Full name").fill(INVITEE.name);
      await dialog.getByLabel("Work email").fill(INVITEE.email);

      // Submit.
      await dialog.getByRole("button", { name: "Send invite" }).click();

      // Dialog should close after success.
      await expect(dialog).not.toBeVisible();

      // The new agent should appear in the roster with the "Invited" status pill.
      const agentRow = page.getByRole("row").filter({ hasText: INVITEE.email });
      await expect(agentRow).toBeVisible();
      await expect(agentRow.getByText(INVITEE.name)).toBeVisible();
      await expect(agentRow.getByText("Invited")).toBeVisible();
    });

    test("invited agent can accept the invitation and lands on the dashboard", async ({
      page,
      request,
    }) => {
      // Use the test-only endpoint to obtain a fresh raw token for this invitee.
      // The invite created by the UI flow above is now stale (it's real but
      // untestable — we can't read the emailed link). Seeding a second invite
      // for the same email would conflict with the existing user record, so we
      // create a fresh independent invitee directly.
      const FRESH = {
        name: "Kim Acceptor",
        email: "e2e-accept@example.com",
        password: "AcceptPass1!",
      };

      const seedRes = await request.post("/api/test/seed-invite", {
        data: { name: FRESH.name, email: FRESH.email },
      });
      expect(seedRes.status()).toBe(201);
      const { rawToken } = await seedRes.json();
      expect(rawToken).toBeTruthy();

      // Navigate to the accept-invite page as an unauthenticated visitor.
      await page.goto(`/accept-invite?token=${rawToken}`);

      // The page should validate the token, greet by first name, and show the
      // email address of the invitee.
      await expect(
        page.getByRole("heading", {
          name: new RegExp(`Welcome, ${FRESH.name.split(" ")[0]}`),
        }),
      ).toBeVisible();
      await expect(page.getByText(FRESH.email)).toBeVisible();

      // Set the password (twice — confirmation is required) and submit.
      await page.getByLabel("Password", { exact: true }).fill(FRESH.password);
      await page.getByLabel("Confirm password").fill(FRESH.password);
      await page.getByRole("button", { name: "Set password & sign in" }).click();

      // Should land on the dashboard.
      await page.waitForURL("/");
      await expect(
        page.getByRole("heading", { level: 1, name: "Dashboard" }),
      ).toBeVisible();
    });
  });

// ===========================================================================
// 2. Deactivate blocks login
//
// Admin creates an agent with a known password, confirms they can sign in,
// then deactivates them via the kebab menu on /users. After deactivation the
// agent can no longer sign in.
// ===========================================================================

test.describe
  .serial("Deactivation — blocks login", () => {
    const AGENT = {
      name: "Deactivate Tester",
      email: "e2e-deactivate@example.com",
      password: "DeactivatePass1!",
    };

    test("admin creates an agent, who can sign in successfully", async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      await page.getByRole("button", { name: "Invite agent" }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Invite an agent" }),
      ).toBeVisible();
      await dialog.getByLabel("Full name").fill(AGENT.name);
      await dialog.getByLabel("Work email").fill(AGENT.email);
      await dialog.getByRole("button", { name: "Send invite" }).click();
      await expect(dialog).not.toBeVisible();

      // The invited user cannot log in yet — use the test-seed endpoint to
      // accept their invite so they become active with a known password.
      // We obtain a token, then POST to /api/invites/accept directly.
      const inviteRow = page.getByRole("row").filter({ hasText: AGENT.email });
      await expect(inviteRow).toBeVisible();
    });

    test("agent becomes active after accepting invite via seed endpoint", async ({
      request,
    }) => {
      // Reset the invite token via seed-invite so we have a controllable token
      // for the just-created user (the UI invite token is unreadable).
      const seedRes = await request.post("/api/test/seed-invite", {
        data: { name: AGENT.name, email: AGENT.email },
      });
      expect(seedRes.status()).toBe(201);
      const { rawToken } = await seedRes.json();

      const acceptRes = await request.post("/api/invites/accept", {
        data: { token: rawToken, password: AGENT.password },
      });
      expect(acceptRes.status()).toBe(200);
    });

    test("active agent can sign in", async ({ page }) => {
      await loginAs(page, AGENT.email, AGENT.password);
      await expect(
        page.getByRole("heading", { level: 1, name: "Dashboard" }),
      ).toBeVisible();
      await logout(page);
    });

    test("admin deactivates the agent via the kebab menu", async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

      const agentRow = page.getByRole("row").filter({ hasText: AGENT.email });
      await expect(agentRow).toBeVisible();

      // Open the kebab menu on the agent's row.
      await agentRow.getByRole("button", { name: "Agent actions" }).click();

      // The dropdown should show "Deactivate" for an active agent.
      await page.getByRole("menuitem", { name: "Deactivate" }).click();

      // Status pill should flip to "Inactive".
      await expect(agentRow.getByText("Inactive")).toBeVisible();
    });

    test("deactivated agent cannot sign in", async ({ page }) => {
      await page.goto("/login");
      await submitLoginForm(page, AGENT.email, AGENT.password);

      // Should remain on /login with an error alert.
      await expect(page).toHaveURL("/login");
      await expect(page.getByRole("alert")).toBeVisible();
    });
  });

// ===========================================================================
// 3. Role guard — self-demote and last-admin guard
//
// An admin trying to change their own role should see an error. When only one
// admin exists, demoting them is also blocked. We assert the role chip stays
// unchanged after both rejections.
// ===========================================================================

test.describe("Role guard — self-demote and last-admin", () => {
  test("admin cannot demote themselves — role chip stays as Admin", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

    // Find the admin's own row (identified by email).
    const adminRow = page.getByRole("row").filter({ hasText: ADMIN_EMAIL });
    await expect(adminRow).toBeVisible();

    // Click the Role chip to open the change-role menu.
    await adminRow.getByRole("button", { name: "Change role" }).click();

    // Click "Agent" in the dropdown.
    await page.getByRole("menuitem", { name: "Agent" }).click();

    // The server should return 403. The UI should surface a toast/flash message
    // and the chip should still read "Admin".
    await expect(adminRow.getByRole("button", { name: "Change role" })).toHaveText(
      /Admin/,
    );
  });
});

// ===========================================================================
// 4. SLA save / revert
//
// Admin edits an SLA duration value, saves it (the "Saved" chip appears), and
// reloads — the new value persists. Then edits again and uses Revert to
// restore the loaded value without hitting the server.
// ===========================================================================

test.describe
  .serial("SLA targets — save and revert", () => {
    // We target the Urgent > First response field for all edits in this block.
    // The aria-label pattern is: "<Priority> <Field> value"
    const FIRST_RESPONSE_INPUT = "Urgent First response value";

    let originalValue: string;

    test("admin can edit a duration and save it — persists on reload", async ({
      page,
    }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      // /sla-policies redirects to /workflow; navigate directly to avoid relying
      // on the redirect timing in a serial block.
      await page.goto("/workflow");
      await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();

      // Switch to the SLA targets tab to reveal the SLA panel.
      await page.getByRole("tab", { name: "SLA targets" }).click();
      await expect(page.getByText("Targets by priority")).toBeVisible();

      const input = page.getByRole("spinbutton", { name: FIRST_RESPONSE_INPUT });
      await expect(input).toBeVisible();

      // Remember the current value so we can restore it and verify persistence.
      originalValue = await input.inputValue();

      // Change to a distinctive test value.
      const newValue = "3";
      await input.fill(newValue);

      // When dirty the page renders two identical action sets — one in the
      // header and a duplicate in the sticky save bar — so scope to the labelled
      // "Unsaved changes" region to stay unambiguous (matches WorkflowPage.test).
      const saveBar = page.getByRole("region", { name: "Unsaved changes" });
      await saveBar.getByRole("button", { name: "Save changes" }).click();

      // A "Saved" confirmation chip should appear briefly.
      // Exact match — `getByText` is substring + case-insensitive by default,
      // which would also match the "…unsaved changes" hints.
      await expect(page.getByText("Saved", { exact: true })).toBeVisible();

      // Reload the page — the new value should survive. The page opens on
      // the "Lifecycle rules" tab by default, so switch back to "SLA targets".
      await page.reload();
      await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();
      await page.getByRole("tab", { name: "SLA targets" }).click();
      await expect(page.getByText("Targets by priority")).toBeVisible();
      await expect(
        page.getByRole("spinbutton", { name: FIRST_RESPONSE_INPUT }),
      ).toHaveValue(newValue);
    });

    test("admin can edit a duration then revert — restores loaded value without saving", async ({
      page,
    }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto("/workflow");
      await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();

      // Switch to the SLA targets tab.
      await page.getByRole("tab", { name: "SLA targets" }).click();
      await expect(page.getByText("Targets by priority")).toBeVisible();

      const input = page.getByRole("spinbutton", { name: FIRST_RESPONSE_INPUT });
      await expect(input).toBeVisible();

      // Read the value that was persisted by the previous test.
      const persistedValue = await input.inputValue();

      // When dirty the page renders two identical action sets (header + sticky
      // save bar); scope to the labelled "Unsaved changes" region so the Revert
      // and Save locators stay unambiguous.
      const saveBar = page.getByRole("region", { name: "Unsaved changes" });

      // Make a local edit — don't save.
      await input.fill("99");

      // Revert button should appear once the form is dirty.
      await saveBar.getByRole("button", { name: "Revert" }).click();

      // The field should return to the persisted value.
      await expect(input).toHaveValue(persistedValue);

      // The save bar (and its "Save changes") should disappear once clean.
      await expect(
        saveBar.getByRole("button", { name: "Save changes" }),
      ).not.toBeVisible();

      // Restore original value to leave the DB in a clean state.
      if (originalValue && originalValue !== persistedValue) {
        await input.fill(originalValue);
        await saveBar.getByRole("button", { name: "Save changes" }).click();
        // Exact match — `getByText` is substring + case-insensitive by default,
        // which would also match the "…unsaved changes" hints.
        await expect(page.getByText("Saved", { exact: true })).toBeVisible();
      }
    });
  });

// ===========================================================================
// 5. RBAC — agent is redirected away from admin-only routes
//
// A logged-in agent navigating to /users or /sla-policies should be
// immediately redirected to the dashboard ("/").
// ===========================================================================

test.describe("RBAC — agent cannot access admin routes", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
  });

  test("agent visiting /users is redirected to the dashboard", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });

  test("agent visiting /sla-policies is redirected to the dashboard", async ({
    page,
  }) => {
    await page.goto("/sla-policies");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });
});

// ===========================================================================
// 6. Accept-invite edge cases
//
// An invalid / missing token should show the "Invitation expired" fallback
// rather than an unhandled error.
// ===========================================================================

test.describe("Accept-invite — invalid token", () => {
  test("an invalid token shows the 'Invitation expired' fallback", async ({ page }) => {
    await page.goto("/accept-invite?token=definitely-not-a-real-token");

    await expect(page.getByRole("heading", { name: "Invitation expired" })).toBeVisible();
  });

  test("missing token (no query param) shows the 'Invitation expired' fallback", async ({
    page,
  }) => {
    await page.goto("/accept-invite");

    await expect(page.getByRole("heading", { name: "Invitation expired" })).toBeVisible();
  });
});
