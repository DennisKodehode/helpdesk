import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// ===========================================================================
// Password reset — full self-service flow
//
// Journey: /login → "Forgot password?" → /forgot-password → submit email →
// "Check your inbox" → read token from verification table → navigate to
// /reset-password?token=<TOKEN> → set new password → "Password updated" →
// /login → sign in with new password → dashboard.
//
// A separate quick check covers the invalid/missing-token "Link expired" state.
// ===========================================================================

const RESET_USER = {
  name: "Reset Tester",
  email: "e2e-reset@example.com",
  originalPassword: "OriginalPass1!",
  newPassword: "NewPassword2@",
};

test.describe
  .serial("Password reset — happy path", () => {
    // -------------------------------------------------------------------------
    // Setup: seed an active agent with a known password.
    // Teardown: delete the user and all related rows.
    // -------------------------------------------------------------------------
    test.beforeAll(async ({ request }) => {
      const res = await request.post("/api/test/seed-user", {
        data: {
          name: RESET_USER.name,
          email: RESET_USER.email,
          password: RESET_USER.originalPassword,
        },
      });
      expect(res.status()).toBe(201);
    });

    test.afterAll(async ({ request }) => {
      await request.post("/api/test/delete-user", {
        data: { email: RESET_USER.email },
      });
    });

    // -------------------------------------------------------------------------
    // Step 1: Navigate from /login to /forgot-password via the link.
    // -------------------------------------------------------------------------
    test('login page has a "Forgot password?" link that navigates to /forgot-password', async ({
      page,
    }) => {
      await page.goto("/login");

      await page.getByRole("link", { name: "Forgot password?" }).click();

      await expect(page).toHaveURL("/forgot-password");
      await expect(page.getByRole("heading", { name: "Forgot password?" })).toBeVisible();
    });

    // -------------------------------------------------------------------------
    // Step 2: Submit the email — see the "Check your inbox" confirmation.
    // -------------------------------------------------------------------------
    test("submitting the email shows the check-your-inbox confirmation", async ({
      page,
    }) => {
      await page.goto("/forgot-password");

      await page.getByLabel("Email").fill(RESET_USER.email);
      await page.getByRole("button", { name: /send reset link/i }).click();

      await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    });

    // -------------------------------------------------------------------------
    // Step 3: Read token from DB, visit /reset-password?token=..., set new
    // password, see "Password updated".
    // -------------------------------------------------------------------------
    test("visiting reset URL with a valid token shows the set-password form", async ({
      page,
      request,
    }) => {
      // Ensure a fresh token exists by triggering the request programmatically
      // (the previous test step may run in a different browser context, so we
      // always trigger here to guarantee a token row exists for this test).
      const triggerRes = await request.post("/api/auth/request-password-reset", {
        data: {
          email: RESET_USER.email,
          redirectTo: "http://localhost:5173/reset-password",
        },
      });
      // Better Auth returns 200 for both found and not-found emails
      // (enumeration-safe). Accept 200 and any 2xx.
      expect(triggerRes.ok()).toBeTruthy();

      // Read the token straight from the verification table.
      const tokenRes = await request.get(
        `/api/test/get-reset-token?email=${encodeURIComponent(RESET_USER.email)}`,
      );
      expect(tokenRes.status()).toBe(200);
      const { token } = await tokenRes.json();
      expect(token).toBeTruthy();

      // Navigate to the reset page with the token.
      await page.goto(`/reset-password?token=${token}`);

      await expect(
        page.getByRole("heading", { name: "Set a new password" }),
      ).toBeVisible();
    });

    test("submitting the new password shows the password-updated confirmation", async ({
      page,
      request,
    }) => {
      // Trigger a fresh reset so we have a valid token for this step.
      const triggerRes = await request.post("/api/auth/request-password-reset", {
        data: {
          email: RESET_USER.email,
          redirectTo: "http://localhost:5173/reset-password",
        },
      });
      expect(triggerRes.ok()).toBeTruthy();

      const tokenRes = await request.get(
        `/api/test/get-reset-token?email=${encodeURIComponent(RESET_USER.email)}`,
      );
      expect(tokenRes.status()).toBe(200);
      const { token } = await tokenRes.json();

      await page.goto(`/reset-password?token=${token}`);
      await expect(
        page.getByRole("heading", { name: "Set a new password" }),
      ).toBeVisible();

      await page.getByLabel("New password").fill(RESET_USER.newPassword);
      await page.getByLabel("Confirm password").fill(RESET_USER.newPassword);
      await page.getByRole("button", { name: /reset password/i }).click();

      await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
    });

    // -------------------------------------------------------------------------
    // Step 4: Sign in with the NEW password — must reach the dashboard.
    // -------------------------------------------------------------------------
    test("user can sign in with the new password after a successful reset", async ({
      page,
    }) => {
      await loginAs(page, RESET_USER.email, RESET_USER.newPassword);

      await expect(
        page.getByRole("heading", { level: 1, name: "Dashboard" }),
      ).toBeVisible();
    });

    // -------------------------------------------------------------------------
    // Bonus: the "Password updated" state has a "Back to sign in" link.
    // -------------------------------------------------------------------------
    test('"Password updated" state has a "Back to sign in" link that goes to /login', async ({
      page,
      request,
    }) => {
      const triggerRes = await request.post("/api/auth/request-password-reset", {
        data: {
          email: RESET_USER.email,
          redirectTo: "http://localhost:5173/reset-password",
        },
      });
      expect(triggerRes.ok()).toBeTruthy();

      const tokenRes = await request.get(
        `/api/test/get-reset-token?email=${encodeURIComponent(RESET_USER.email)}`,
      );
      expect(tokenRes.status()).toBe(200);
      const { token } = await tokenRes.json();

      await page.goto(`/reset-password?token=${token}`);
      await page.getByLabel("New password").fill(RESET_USER.newPassword);
      await page.getByLabel("Confirm password").fill(RESET_USER.newPassword);
      await page.getByRole("button", { name: /reset password/i }).click();
      await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();

      await page.getByRole("link", { name: /back to sign in/i }).click();
      await expect(page).toHaveURL("/login");
    });
  });

// ===========================================================================
// Invalid / missing token guard — "Link expired" state
// ===========================================================================

test.describe("Password reset — invalid token guard", () => {
  test("visiting /reset-password with no token shows the link-expired state", async ({
    page,
  }) => {
    await page.goto("/reset-password");

    await expect(page.getByRole("heading", { name: "Link expired" })).toBeVisible();
  });

  test("visiting /reset-password with ?error=INVALID_TOKEN shows the link-expired state", async ({
    page,
  }) => {
    // Better Auth's server-side callback redirects expired/invalid links to
    // /reset-password?error=INVALID_TOKEN. The page shows "Link expired" for
    // any truthy `error` query param.
    await page.goto("/reset-password?error=INVALID_TOKEN");
    await expect(page.getByRole("heading", { name: "Link expired" })).toBeVisible();
  });

  test("the link-expired state has a link back to /forgot-password", async ({ page }) => {
    await page.goto("/reset-password?error=INVALID_TOKEN");

    await page.getByRole("link", { name: /request a new link/i }).click();
    await expect(page).toHaveURL("/forgot-password");
  });
});

// ===========================================================================
// Forgot password — non-existent email still shows confirmation (enumeration-safe)
// ===========================================================================

test.describe("Forgot password — enumeration safety", () => {
  test("submitting an unknown email still shows the check-your-inbox confirmation", async ({
    page,
  }) => {
    await page.goto("/forgot-password");

    await page.getByLabel("Email").fill("nobody@nowhere-definitely-not-real.example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  });
});
