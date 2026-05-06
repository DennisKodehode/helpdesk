import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAs, logout, submitLoginForm } from "./helpers/auth";

// ---------------------------------------------------------------------------
// Shared test state — the agent created in "Create" is reused by "Edit" and
// "Delete". Tests are ordered and must run sequentially within this describe
// block. fullyParallel is enabled globally, but ordering within a single
// describe block is always top-to-bottom within a single worker.
// ---------------------------------------------------------------------------

const NEW_AGENT = {
  name: "Test Agent",
  email: "testagent@example.com",
  password: "Password123!",
};

const UPDATED_NAME = "Test Agent Renamed";

test.describe.serial("Users page — CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  // =========================================================================
  // 1. Create
  // =========================================================================

  test("admin can create a new agent who then appears in the table", async ({ page }) => {
    // Open the dialog.
    await page.getByRole("button", { name: "Add Agent" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add Agent" })).toBeVisible();

    // Fill the form.
    await dialog.getByLabel("Name").fill(NEW_AGENT.name);
    await dialog.getByLabel("Email").fill(NEW_AGENT.email);
    await dialog.getByLabel("Password").fill(NEW_AGENT.password);

    // Submit.
    await dialog.getByRole("button", { name: "Create Agent" }).click();

    // Dialog should close.
    await expect(dialog).not.toBeVisible();

    // New agent row should appear in the table.
    const newRow = page.getByRole("row").filter({ hasText: NEW_AGENT.email });
    await expect(newRow).toBeVisible();
    await expect(newRow.getByText(NEW_AGENT.name)).toBeVisible();
    await expect(newRow.getByText("agent", { exact: true })).toBeVisible();
  });

  // =========================================================================
  // 3. Edit
  // =========================================================================

  test("admin can edit the created agent and the table reflects the change", async ({ page }) => {
    // Find the row for the agent created in the previous test.
    const agentRow = page.getByRole("row").filter({ hasText: NEW_AGENT.email });
    await expect(agentRow).toBeVisible();

    // Click the Edit (pencil) button on that row.
    await agentRow.getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit Agent" })).toBeVisible();

    // Name and email should be pre-populated.
    await expect(dialog.getByLabel("Name")).toHaveValue(NEW_AGENT.name);
    await expect(dialog.getByLabel("Email")).toHaveValue(NEW_AGENT.email);

    // Change the name, leave password blank.
    await dialog.getByLabel("Name").fill(UPDATED_NAME);

    // Submit.
    await dialog.getByRole("button", { name: "Save Changes" }).click();

    // Dialog should close.
    await expect(dialog).not.toBeVisible();

    // Row should now show the updated name.
    const updatedRow = page.getByRole("row").filter({ hasText: NEW_AGENT.email });
    await expect(updatedRow.getByText(UPDATED_NAME)).toBeVisible();
  });

  // =========================================================================
  // 4. Delete
  // =========================================================================

  test("admin can delete the created agent and they disappear from the table", async ({ page }) => {
    // Find the agent row (identified by their unchanged email).
    const agentRow = page.getByRole("row").filter({ hasText: NEW_AGENT.email });
    await expect(agentRow).toBeVisible();

    // Click the Delete (trash) button on that row.
    await agentRow.getByRole("button", { name: "Delete" }).click();

    // Confirmation dialog should appear.
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog.getByRole("heading", { name: "Delete user?" })).toBeVisible();

    // The dialog should show the agent's name and email.
    await expect(confirmDialog.getByText(UPDATED_NAME)).toBeVisible();
    await expect(confirmDialog.getByText(NEW_AGENT.email)).toBeVisible();

    // Confirm the deletion.
    await confirmDialog.getByRole("button", { name: "Delete" }).click();

    // Dialog should close.
    await expect(confirmDialog).not.toBeVisible();

    // Agent row should no longer appear in the table.
    await expect(
      page.getByRole("row").filter({ hasText: NEW_AGENT.email })
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Integration tests — each test creates and cleans up its own data; no shared
// state with the CRUD block above.
// ---------------------------------------------------------------------------

test.describe.serial("Users page — integration", () => {
  // =========================================================================
  // 1. Password change works end-to-end
  // =========================================================================

  test("changed password is enforced: old password rejected, new password accepted", async ({ page }) => {
    const AGENT = {
      name: "PwChange Agent",
      email: "pwchange@example.com",
      originalPassword: "OriginalPass1!",
      newPassword: "NewPassword2@",
    };

    // Step 1 — Admin creates the agent.
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    await page.getByRole("button", { name: "Add Agent" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByRole("heading", { name: "Add Agent" })).toBeVisible();
    await createDialog.getByLabel("Name").fill(AGENT.name);
    await createDialog.getByLabel("Email").fill(AGENT.email);
    await createDialog.getByLabel("Password").fill(AGENT.originalPassword);
    await createDialog.getByRole("button", { name: "Create Agent" }).click();
    await expect(createDialog).not.toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: AGENT.email })).toBeVisible();

    // Step 2 — Log out, then verify the agent can log in with the original password.
    await logout(page);
    await loginAs(page, AGENT.email, AGENT.originalPassword);
    await expect(page).toHaveURL("/");

    // Step 3 — Log back out, log in as admin, change the agent's password.
    await logout(page);
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    const agentRow = page.getByRole("row").filter({ hasText: AGENT.email });
    await agentRow.getByRole("button", { name: "Edit" }).click();

    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "Edit Agent" })).toBeVisible();
    await editDialog.getByLabel("Password").fill(AGENT.newPassword);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).not.toBeVisible();

    // Step 4 — Log out, try the OLD password — should stay on /login with an error.
    await logout(page);
    await page.goto("/login");
    await submitLoginForm(page, AGENT.email, AGENT.originalPassword);
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("alert")).toBeVisible();

    // Step 5 — Try the NEW password — should reach the dashboard.
    await loginAs(page, AGENT.email, AGENT.newPassword);
    await expect(page).toHaveURL("/");

    // Step 6 — Clean up: log out, log in as admin, delete the agent.
    await logout(page);
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    const cleanupRow = page.getByRole("row").filter({ hasText: AGENT.email });
    await cleanupRow.getByRole("button", { name: "Delete" }).click();

    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog.getByRole("heading", { name: "Delete user?" })).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete" }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: AGENT.email })).not.toBeVisible();
  });

  // =========================================================================
  // 2. Soft-deleted user cannot log in
  // =========================================================================

  test("deleted agent cannot log in", async ({ page }) => {
    const AGENT = {
      name: "Deleted Agent",
      email: "deleted@example.com",
      password: "DeletedPass1!",
    };

    // Step 1 — Admin creates the agent.
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    await page.getByRole("button", { name: "Add Agent" }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog.getByRole("heading", { name: "Add Agent" })).toBeVisible();
    await createDialog.getByLabel("Name").fill(AGENT.name);
    await createDialog.getByLabel("Email").fill(AGENT.email);
    await createDialog.getByLabel("Password").fill(AGENT.password);
    await createDialog.getByRole("button", { name: "Create Agent" }).click();
    await expect(createDialog).not.toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: AGENT.email })).toBeVisible();

    // Step 2 — While still logged in as admin, delete the agent.
    const agentRow = page.getByRole("row").filter({ hasText: AGENT.email });
    await agentRow.getByRole("button", { name: "Delete" }).click();

    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog.getByRole("heading", { name: "Delete user?" })).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete" }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: AGENT.email })).not.toBeVisible();

    // Step 3 — Log out, attempt to log in as the deleted agent — should stay on /login.
    await logout(page);
    await page.goto("/login");
    await submitLoginForm(page, AGENT.email, AGENT.password);
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
