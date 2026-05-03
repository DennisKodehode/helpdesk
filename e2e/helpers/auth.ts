import type { Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@test.example.com";
export const ADMIN_PASSWORD = "TestPassword123!";

export const AGENT_EMAIL = "agent@test.example.com";
export const AGENT_PASSWORD = "AgentPassword123!";

/** Fills the login form and submits. Does NOT assert any outcome. */
export async function submitLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Navigates to /login, submits credentials, and waits for the dashboard. */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await submitLoginForm(page, email, password);
  await page.waitForURL("/");
}

/** Clicks the sign-out button and waits for the redirect to /login. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("/login");
}
