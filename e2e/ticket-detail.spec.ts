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

// Use the test-only seed endpoint to create tickets directly in the DB with
// status "open". This avoids the async AI triage pipeline (new/processing) that
// disables all controls, and the Resend email-body fetch that fails in E2E.
const SEED_TICKET_URL = "http://localhost:3000/api/test/seed-ticket";

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
    status: string;
    priority: string;
  }> = {},
): Promise<CreatedTicket> {
  const response = await request.post(SEED_TICKET_URL, {
    data: {
      fromName: overrides.fromName ?? "Alice Customer",
      fromEmail: overrides.fromEmail ?? "alice@example.com",
      subject: overrides.subject ?? "Test ticket subject",
      body: overrides.body ?? "",
      ...(overrides.status ? { status: overrides.status } : {}),
      ...(overrides.priority ? { priority: overrides.priority } : {}),
    },
    headers: { "content-type": "application/json" },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to seed test ticket: ${response.status()} ${await response.text()}`,
    );
  }

  return (await response.json()) as CreatedTicket;
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

      // Sender details are rendered in the ticket header. The name also
      // appears as the sender label in the ReplyThread bubble, so use .first()
      // to pass strict mode.
      await expect(page.getByText("View Tester").first()).toBeVisible();
      await expect(page.getByText("view-test@example.com").first()).toBeVisible();

      // Message body is visible.
      await expect(
        page.getByText("Hi, I placed an order last week and it hasn't arrived."),
      ).toBeVisible();
    });

    test("ticket detail shows Conversation section with original customer message when no replies yet", async ({
      page,
    }) => {
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
      await page.goto(`/tickets/${ticketId}`);

      // ReplyThread always renders the original customer message as the first
      // bubble, so "Conversation · 1" is the heading when there are no replies.
      await expect(page.getByRole("heading", { name: "Conversation · 1" })).toBeVisible();

      // The original customer message body should be visible.
      await expect(
        page.getByText("Hi, I placed an order last week and it hasn't arrived."),
      ).toBeVisible();

      // There should be no agent reply items yet — only the original message.
      const replyThread = page.getByRole("list", { name: "Reply thread" });
      await expect(replyThread).toBeVisible();
      await expect(replyThread.getByRole("listitem")).toHaveCount(1);
    });

    test("back link navigates to /tickets", async ({ page }) => {
      await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
      await page.goto(`/tickets/${ticketId}`);

      await page.getByRole("link", { name: "All tickets" }).click();
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
      await replyForm.getByRole("button", { name: "Send reply" }).click();

      // The reply should appear in the thread. After submit the thread has
      // 2 items: the original customer message + the agent reply.
      const replyThread = page.getByRole("list", { name: "Reply thread" });
      await expect(replyThread).toBeVisible();
      await expect(
        replyThread.getByText(
          "Thank you for reaching out! We will look into this right away.",
        ),
      ).toBeVisible();

      // The textarea should be cleared after a successful submit.
      await expect(replyBody).toHaveValue("");
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

      // Resolved ticket: agent has no further transitions, so the select is
      // replaced by a static StatusPill. The word "Resolved" can appear in
      // multiple places (pill + any other status indicator), so use .first().
      await expect(page.getByLabel("Change ticket status")).not.toBeVisible();
      await expect(page.getByText("Resolved").first()).toBeVisible();
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
      // "Resolved" also appears in the Activity feed, so use .first() for strict mode.
      await expect(page.getByLabel("Change ticket status")).not.toBeVisible();
      await expect(page.getByText("Resolved").first()).toBeVisible();

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
