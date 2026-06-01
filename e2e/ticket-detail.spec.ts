import { createHmac } from "node:crypto";
import { type APIRequestContext, expect, test } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
  loginAs,
  logout,
} from "./helpers/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The inbound-email webhook is the simplest way to create a ticket without any
// UI flow. We call the server directly (port 3000) because the Vite proxy is
// not involved in Playwright's `request` fixture when using a full URL.
//
// The route verifies a Resend/svix-style HMAC signature. We sign locally using
// the RESEND_WEBHOOK_SECRET from server/.env.test (exposed via `bun --env-file`
// when the suite runs). The algorithm:
//   signedContent = `${svix-id}.${svix-timestamp}.${rawBody}`
//   signature     = HMAC-SHA256(base64-decode(secret[7:]), signedContent) → base64
const WEBHOOK_URL = "http://localhost:3000/api/inbound-email";

function signWebhookPayload(rawBody: string): Record<string, string> {
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");

  const id = `msg_${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const signature = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  return {
    "content-type": "application/json",
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
  };
}

interface CreatedTicket {
  id: number;
  subject: string;
  fromName: string;
  fromEmail: string;
  body: string;
}

async function createTestTicket(
  request: APIRequestContext,
  overrides: Partial<{
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
  }> = {},
): Promise<CreatedTicket> {
  // The Resend webhook delivers email.received events. We mirror that shape.
  const payload = {
    type: "email.received",
    data: {
      email_id: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      from: `${overrides.fromName ?? "Alice Customer"} <${overrides.fromEmail ?? "alice@example.com"}>`,
      subject: overrides.subject ?? "Test ticket subject",
      to: ["support@test.example.com"],
    },
  };

  // POST the exact JSON string — the signature is computed over the raw body.
  const rawBody = JSON.stringify(payload);
  const headers = signWebhookPayload(rawBody);

  const response = await request.post(WEBHOOK_URL, {
    data: rawBody,
    headers,
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to create test ticket: ${response.status()} ${await response.text()}`,
    );
  }

  const json = await response.json();

  // The webhook returns { type: "ticket", ticket: {...} } for a new ticket.
  // If the email already had an open/resolved ticket it returns { type: "reply" }.
  // Using unique fromEmail per test group avoids this collision.
  if (json.type !== "ticket") {
    throw new Error(
      `Webhook returned type "${json.type}" — expected "ticket". Use a unique fromEmail per test group.`,
    );
  }

  return json.ticket as CreatedTicket;
}

// ---------------------------------------------------------------------------
// 1. View ticket — agent navigates to ticket detail and sees content
// ---------------------------------------------------------------------------

test.describe
  .serial("Ticket detail — view", () => {
    let ticketId: number;

    test.beforeAll(async ({ request }) => {
      // Create one ticket for all view tests.
      const ticket = await createTestTicket(request, {
        fromEmail: "view-test@example.com",
        fromName: "View Tester",
        subject: "My order is missing",
        body: "Hi, I placed an order last week and it hasn't arrived.",
      });
      ticketId = ticket.id;
    });

    test("agent can navigate from the tickets list to a ticket and see its details", async ({
      page,
    }) => {
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);

      // Navigate to the tickets list.
      await page.goto("/tickets");
      await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();

      // Click the ticket subject link in the table.
      await page.getByRole("link", { name: "My order is missing" }).click();

      // Verify the URL changed to the detail page.
      await page.waitForURL(`/tickets/${ticketId}`);

      // The ticket subject renders as an h1.
      await expect(
        page.getByRole("heading", { level: 1, name: "My order is missing" }),
      ).toBeVisible();

      // Sender details are rendered in a dl.
      await expect(page.getByText("View Tester")).toBeVisible();
      await expect(page.getByText("view-test@example.com")).toBeVisible();

      // Message body is visible.
      await expect(
        page.getByText("Hi, I placed an order last week and it hasn't arrived."),
      ).toBeVisible();
    });

    test("ticket detail shows Replies section with 'No replies yet' when empty", async ({
      page,
    }) => {
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
      await page.goto(`/tickets/${ticketId}`);

      await expect(page.getByRole("heading", { name: "Replies" })).toBeVisible();
      await expect(page.getByText("No replies yet")).toBeVisible();
    });

    test("back link navigates to /tickets", async ({ page }) => {
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
      await page.goto(`/tickets/${ticketId}`);

      await page.getByRole("link", { name: "Back to tickets" }).click();
      await page.waitForURL("/tickets");

      await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
    });
  });

// ---------------------------------------------------------------------------
// 2. Send a reply — agent submits reply form; reply appears in thread
// ---------------------------------------------------------------------------

test.describe
  .serial("Ticket detail — reply", () => {
    let ticketId: number;

    test.beforeAll(async ({ request }) => {
      const ticket = await createTestTicket(request, {
        fromEmail: "reply-test@example.com",
        fromName: "Reply Tester",
        subject: "Reply test ticket",
        body: "Please reply to this ticket.",
      });
      ticketId = ticket.id;
    });

    test("agent types a reply and it appears in the reply thread after submit", async ({
      page,
    }) => {
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
      await page.goto(`/tickets/${ticketId}`);

      // Verify the reply form is present.
      const replyForm = page.getByRole("form", { name: "Reply form" });
      await expect(replyForm).toBeVisible();

      // Type a reply.
      const replyBody = page.getByLabel("Reply body");
      await replyBody.fill(
        "Thank you for reaching out! We will look into this right away.",
      );

      // Submit the form.
      await replyForm.getByRole("button", { name: "Send Reply" }).click();

      // The reply should appear in the thread.
      const replyThread = page.getByRole("list", { name: "Reply thread" });
      await expect(replyThread).toBeVisible();
      await expect(
        replyThread.getByText(
          "Thank you for reaching out! We will look into this right away.",
        ),
      ).toBeVisible();

      // The textarea should be cleared after a successful submit.
      await expect(replyBody).toHaveValue("");

      // "No replies yet" should no longer be shown.
      await expect(page.getByText("No replies yet")).not.toBeVisible();
    });
  });

// ---------------------------------------------------------------------------
// 3. Change status — agent changes open → resolved; sidebar reflects new value
// ---------------------------------------------------------------------------

test.describe
  .serial("Ticket detail — change status", () => {
    let ticketId: number;

    test.beforeAll(async ({ request }) => {
      const ticket = await createTestTicket(request, {
        fromEmail: "status-test@example.com",
        fromName: "Status Tester",
        subject: "Status change ticket",
        body: "This ticket will have its status changed.",
      });
      ticketId = ticket.id;
    });

    test("agent can change an open ticket to resolved via the status dropdown", async ({
      page,
    }) => {
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
      await page.goto(`/tickets/${ticketId}`);

      // The status select trigger should show "Open" initially.
      const statusSelect = page.getByLabel("Change ticket status");
      await expect(statusSelect).toBeVisible();
      await expect(statusSelect).toContainText("Open");

      // Open the dropdown and select "Resolved".
      await statusSelect.click();
      await page.getByRole("option", { name: "Resolved" }).click();

      // Resolved ticket: agent has no further transitions, so select is replaced by a static badge.
      await expect(page.getByLabel("Change ticket status")).not.toBeVisible();
      await expect(page.getByText("Resolved")).toBeVisible();
    });

    test("admin can change a resolved ticket to closed via the status dropdown", async ({
      page,
      request,
    }) => {
      // Create a separate resolved ticket for this test by:
      // 1. Creating a fresh ticket via the webhook.
      // 2. Patching it to resolved via the API (requires admin auth cookie).
      //
      // Since patching via the API needs session auth, the simplest approach is
      // to use the UI: log in as agent, resolve the ticket, then log in as admin.

      const resolvedTicket = await createTestTicket(request, {
        fromEmail: "close-test@example.com",
        fromName: "Close Tester",
        subject: "Ticket to be closed",
        body: "Resolve me first, then close.",
      });

      // Step 1 — Agent resolves the ticket via the UI.
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
      await page.goto(`/tickets/${resolvedTicket.id}`);
      const agentStatusSelect = page.getByLabel("Change ticket status");
      await expect(agentStatusSelect).toContainText("Open");
      await agentStatusSelect.click();
      await page.getByRole("option", { name: "Resolved" }).click();
      // Agent has no further transitions from Resolved, so select is replaced by a static badge.
      await expect(page.getByLabel("Change ticket status")).not.toBeVisible();
      await expect(page.getByText("Resolved")).toBeVisible();

      // Step 2 — Sign out the agent, then log in as admin.
      await logout(page);
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto(`/tickets/${resolvedTicket.id}`);

      const adminStatusSelect = page.getByLabel("Change ticket status");
      await expect(adminStatusSelect).toContainText("Resolved");

      await adminStatusSelect.click();
      await page.getByRole("option", { name: "Closed" }).click();

      // Admin can reopen closed tickets, so the select stays visible — it now shows "Closed".
      await expect(adminStatusSelect).toContainText("Closed");
    });
  });

// ---------------------------------------------------------------------------
// 4. Change category — agent sets a category; sidebar reflects new value
// ---------------------------------------------------------------------------

test.describe
  .serial("Ticket detail — change category", () => {
    let ticketId: number;

    test.beforeAll(async ({ request }) => {
      const ticket = await createTestTicket(request, {
        fromEmail: "category-test@example.com",
        fromName: "Category Tester",
        subject: "Category change ticket",
        body: "This ticket will have its category changed.",
      });
      ticketId = ticket.id;
    });

    test("agent can set a category and the category dropdown reflects the new value", async ({
      page,
    }) => {
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
      await page.goto(`/tickets/${ticketId}`);

      // Category select trigger should show "None" when no category is set.
      const categorySelect = page.getByLabel("Change ticket category");
      await expect(categorySelect).toBeVisible();
      await expect(categorySelect).toContainText("None");

      // Open the dropdown and select "Billing".
      await categorySelect.click();
      await page.getByRole("option", { name: "Billing" }).click();

      // The trigger should now show "Billing".
      await expect(categorySelect).toContainText("Billing");
    });
  });

// ---------------------------------------------------------------------------
// 5. Assign ticket — admin assigns ticket to the seeded agent
// ---------------------------------------------------------------------------

test.describe
  .serial("Ticket detail — assign ticket", () => {
    let ticketId: number;

    test.beforeAll(async ({ request }) => {
      const ticket = await createTestTicket(request, {
        fromEmail: "assign-test@example.com",
        fromName: "Assign Tester",
        subject: "Assignment test ticket",
        body: "Please assign this ticket.",
      });
      ticketId = ticket.id;
    });

    test("admin can assign a ticket to an agent and the assign dropdown reflects the agent name", async ({
      page,
    }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto(`/tickets/${ticketId}`);

      // The assign select should show "Unassigned" initially.
      const assignSelect = page.getByLabel("Assign ticket");
      await expect(assignSelect).toBeVisible();
      await expect(assignSelect).toContainText("Unassigned");

      // Open the dropdown — the seeded agent "Test Agent" should be listed.
      await assignSelect.click();
      await page.getByRole("option", { name: "Test Agent" }).click();

      // The trigger should now show the agent's name.
      await expect(assignSelect).toContainText("Test Agent");
    });

    test("admin can unassign a ticket back to Unassigned", async ({ page }) => {
      // Navigate to the same ticket that was just assigned.
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto(`/tickets/${ticketId}`);

      const assignSelect = page.getByLabel("Assign ticket");
      // After the previous test, it should now show "Test Agent".
      await expect(assignSelect).toContainText("Test Agent");

      // Open and select "Unassigned".
      await assignSelect.click();
      await page.getByRole("option", { name: "Unassigned" }).click();

      await expect(assignSelect).toContainText("Unassigned");
    });
  });
