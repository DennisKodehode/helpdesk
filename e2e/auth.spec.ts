import { expect, test } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
  loginAs,
  logout,
} from "./helpers/auth";

// ===========================================================================
// 1. Happy-path login
// ===========================================================================

test.describe("Happy-path login", () => {
  test("admin can log in and is redirected to the dashboard", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });

  test("already-authenticated user visiting /login is redirected to dashboard", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });
});

// ===========================================================================
// 2. Unauthenticated access guard
// ===========================================================================

test.describe("Unauthenticated access guard", () => {
  test("visiting a protected route redirects to /login", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/login");
  });
});

// ===========================================================================
// 3. Logout
// ===========================================================================

test.describe("Logout", () => {
  test("signed-in user can sign out and is redirected to /login", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await logout(page);

    await expect(page).toHaveURL("/login");
  });
});

// ===========================================================================
// 4. Role-based access control
// ===========================================================================

test.describe("Role-based access control", () => {
  test("admin can access the /users page", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("agent cannot access /users and is redirected to dashboard", async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/users");

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });
});
