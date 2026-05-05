import { test, expect } from "@playwright/test";
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
// 1. Happy-path login
// ===========================================================================

test.describe("Happy-path login", () => {
  test("admin can log in and is redirected to the dashboard", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  });

  test("already-authenticated user visiting /login is redirected to dashboard", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });
});

// ===========================================================================
// 2. Login failure — server-side errors
// (Frontend form validation is covered by component tests)
// ===========================================================================

test.describe("Login failure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows an error for wrong password", async ({ page }) => {
    await submitLoginForm(page, ADMIN_EMAIL, "WrongPassword!");

    await expect(page).toHaveURL("/login");
    await expect(
      page.getByText(/invalid credentials/i).or(page.getByText(/invalid email or password/i))
    ).toBeVisible();
  });

  test("shows an error for a non-existent email", async ({ page }) => {
    await submitLoginForm(page, "nobody@nowhere.example.com", "AnyPassword123!");

    await expect(page).toHaveURL("/login");
    await expect(
      page.getByText(/invalid credentials/i).or(page.getByText(/invalid email or password/i))
    ).toBeVisible();
  });
});

// ===========================================================================
// 3. Unauthenticated access guard
// ===========================================================================

test.describe("Unauthenticated access guard", () => {
  test("visiting a protected route redirects to /login", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/login");
  });
});

// ===========================================================================
// 4. Logout
// ===========================================================================

test.describe("Logout", () => {
  test("signed-in user can sign out and is redirected to /login", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await logout(page);

    await expect(page).toHaveURL("/login");
  });
});

// ===========================================================================
// 5. Role-based access control
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
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  });
});
