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

  test("agent can log in and is redirected to the dashboard", async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
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
// 2. Login failure and form validation
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

  test("shows a validation error when email field is empty", async ({ page }) => {
    await page.getByLabel("Password").fill("SomePassword!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByText(/invalid email address/i)).toBeVisible();
  });

  test("shows a validation error when password field is empty", async ({ page }) => {
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test("shows a validation error for an invalid email format", async ({ page }) => {
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("SomePassword!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByText(/invalid email address/i)).toBeVisible();
  });

  test("shows validation errors when both fields are empty", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByText(/invalid email address/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
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

  test("visiting an admin route while unauthenticated redirects to /login", async ({ page }) => {
    await page.goto("/users");

    await expect(page).toHaveURL("/login");
  });

  test("unknown routes redirect to dashboard, which in turn redirects to /login", async ({
    page,
  }) => {
    await page.goto("/some/unknown/path");

    await expect(page).toHaveURL("/login");
  });
});

// ===========================================================================
// 4. Logout
// ===========================================================================

test.describe("Logout", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("signed-in user can sign out and is redirected to /login", async ({ page }) => {
    await logout(page);

    await expect(page).toHaveURL("/login");
  });

  test("after sign-out, protected routes redirect to /login", async ({ page }) => {
    await logout(page);

    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });
});

// ===========================================================================
// 5. Authorization guards (role-based)
// ===========================================================================

test.describe("Authorization — admin", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("admin can access the /users page", async ({ page }) => {
    await page.goto("/users");

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("admin sees a 'Users' link in the navbar", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  });

  test("admin can navigate to /users via the navbar link", async ({ page }) => {
    await page.getByRole("link", { name: "Users" }).click();

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });
});

test.describe("Authorization — agent", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
  });

  test("agent cannot access /users and is redirected to dashboard", async ({ page }) => {
    await page.goto("/users");

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  });

  test("agent does not see a 'Users' link in the navbar", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();
  });
});
