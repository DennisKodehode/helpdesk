import { type AuditEvent, AuditEventType, SenderType } from "@helpdesk/core";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor, within } from "../test/utils";
import ActivityFeed from "./ActivityFeed";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function mockAuditAndAgents(
  events: AuditEvent[],
  agents: { id: string; name: string; email: string }[] = [],
) {
  vi.mocked(axios.get).mockImplementation(async (url: string) => {
    if (url.includes("/audit-events")) return { data: events };
    if (url === "/api/agents") return { data: agents };
    return { data: [] };
  });
}

const baseActor = { id: "agent-1", name: "Bob Agent" };

describe("ActivityFeed", () => {
  it("renders the empty state when there are no events", async () => {
    mockAuditAndAgents([]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
  });

  it("renders a status_changed event with from → to labels", async () => {
    mockAuditAndAgents([
      {
        id: "ev-1",
        type: AuditEventType.status_changed,
        actor: baseActor,
        data: { from: "open", to: "resolved" },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const item = await screen.findByText(/changed status/);
    expect(item).toHaveTextContent("Bob Agent");
    expect(item).toHaveTextContent("Open");
    expect(item).toHaveTextContent("Resolved");
  });

  it("renders an assignee_changed event with the agent name resolved from /api/agents", async () => {
    mockAuditAndAgents(
      [
        {
          id: "ev-2",
          type: AuditEventType.assignee_changed,
          actor: baseActor,
          data: { from: null, to: "agent-99" },
          createdAt: new Date().toISOString(),
        },
      ],
      [{ id: "agent-99", name: "Alice", email: "alice@example.com" }],
    );
    renderWithProviders(<ActivityFeed ticketId="42" />);

    expect(await screen.findByText(/assigned to Alice/)).toBeInTheDocument();
  });

  it("renders 'unassigned the ticket' when assignee_changed.to is null", async () => {
    mockAuditAndAgents([
      {
        id: "ev-3",
        type: AuditEventType.assignee_changed,
        actor: baseActor,
        data: { from: "agent-x", to: null },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    expect(await screen.findByText(/unassigned the ticket/)).toBeInTheDocument();
  });

  it("renders the system 'Auto-unassigned on reopen' label when reopenUnassigned is true", async () => {
    mockAuditAndAgents([
      {
        id: "ev-4",
        type: AuditEventType.assignee_changed,
        actor: baseActor,
        data: { from: "ai-user", to: null, reopenUnassigned: true },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    expect(await screen.findByText("Auto-unassigned on reopen")).toBeInTheDocument();
  });

  it("renders a priority_changed event with the new priority label", async () => {
    mockAuditAndAgents([
      {
        id: "ev-5",
        type: AuditEventType.priority_changed,
        actor: baseActor,
        data: { from: "normal", to: "urgent" },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const item = await screen.findByText(/set priority to/);
    expect(item).toHaveTextContent("Urgent");
  });

  it("renders a category_changed event with the new category label", async () => {
    mockAuditAndAgents([
      {
        id: "ev-6",
        type: AuditEventType.category_changed,
        actor: baseActor,
        data: { from: null, to: "billing_inquiry" },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const item = await screen.findByText(/set category to/);
    expect(item).toHaveTextContent("Billing");
  });

  it("renders 'cleared the category' when category_changed.to is null", async () => {
    mockAuditAndAgents([
      {
        id: "ev-7",
        type: AuditEventType.category_changed,
        actor: baseActor,
        data: { from: "general_question", to: null },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    expect(await screen.findByText(/cleared the category/)).toBeInTheDocument();
  });

  it("renders a reply_added (agent) event as a link to #reply-<id>", async () => {
    mockAuditAndAgents([
      {
        id: "ev-8",
        type: AuditEventType.reply_added,
        actor: baseActor,
        data: { replyId: 77, senderType: SenderType.agent },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const link = await screen.findByRole("link", { name: /Bob Agent replied/i });
    expect(link).toHaveAttribute("href", "#reply-77");
  });

  it("renders a reply_added (internal_note) event with the 'added an internal note' phrasing", async () => {
    mockAuditAndAgents([
      {
        id: "ev-9",
        type: AuditEventType.reply_added,
        actor: baseActor,
        data: { replyId: 88, senderType: SenderType.internal_note },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const link = await screen.findByRole("link", {
      name: /Bob Agent added an internal note/i,
    });
    expect(link).toHaveAttribute("href", "#reply-88");
  });

  it("renders a reply_added (customer) event as 'Customer replied'", async () => {
    mockAuditAndAgents([
      {
        id: "ev-10",
        type: AuditEventType.reply_added,
        actor: null,
        data: { replyId: 99, senderType: SenderType.customer },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const link = await screen.findByRole("link", { name: /Customer replied/i });
    expect(link).toHaveAttribute("href", "#reply-99");
  });

  it("renders a ticket_created event with the fromEmail", async () => {
    mockAuditAndAgents([
      {
        id: "ev-tc",
        type: AuditEventType.ticket_created,
        actor: null,
        data: { fromEmail: "alice@example.com" },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const item = await screen.findByText(/Ticket created from/);
    expect(item).toHaveTextContent("alice@example.com");
  });

  it("renders an auto_resolved event as a link to #reply-<id>", async () => {
    mockAuditAndAgents([
      {
        id: "ev-ar",
        type: AuditEventType.auto_resolved,
        actor: { id: "ai", name: "AI" },
        data: { replyId: 555 },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const link = await screen.findByRole("link", {
      name: /AI auto-resolved the ticket/i,
    });
    expect(link).toHaveAttribute("href", "#reply-555");
  });

  it("renders an ai_escalated event with the reason in a title attribute", async () => {
    mockAuditAndAgents([
      {
        id: "ev-esc",
        type: AuditEventType.ai_escalated,
        actor: { id: "ai", name: "AI" },
        data: { reason: "ai_chose_escalate" },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const item = await screen.findByTitle("ai_chose_escalate");
    expect(item).toHaveTextContent("AI escalated to humans");
  });

  it("renders an auto_reopened event", async () => {
    mockAuditAndAgents([
      {
        id: "ev-rop",
        type: AuditEventType.auto_reopened,
        actor: null,
        data: {},
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    expect(
      await screen.findByText("Auto-reopened on customer reply"),
    ).toBeInTheDocument();
  });

  it("renders an auto_closed event", async () => {
    mockAuditAndAgents([
      {
        id: "ev-cls",
        type: AuditEventType.auto_closed,
        actor: null,
        data: {},
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    expect(await screen.findByText("Auto-closed after 96h")).toBeInTheDocument();
  });

  it("renders an assignee_changed with reason=user_deleted suffix", async () => {
    mockAuditAndAgents([
      {
        id: "ev-del",
        type: AuditEventType.assignee_changed,
        actor: { id: "admin-1", name: "Admin Alice" },
        data: { from: "deleted-id", to: null, reason: "user_deleted" },
        createdAt: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const item = await screen.findByText(/unassigned the ticket \(agent deleted\)/i);
    expect(item).toHaveTextContent("Admin Alice");
  });

  it("preserves ordering of multiple events from the API", async () => {
    mockAuditAndAgents([
      {
        id: "a",
        type: AuditEventType.status_changed,
        actor: baseActor,
        data: { from: "open", to: "resolved" },
        createdAt: "2024-01-01T10:00:00Z",
      },
      {
        id: "b",
        type: AuditEventType.priority_changed,
        actor: baseActor,
        data: { from: "normal", to: "urgent" },
        createdAt: "2024-01-01T11:00:00Z",
      },
    ]);
    renderWithProviders(<ActivityFeed ticketId="42" />);

    const list = await screen.findByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/changed status/);
    expect(items[1]).toHaveTextContent(/set priority/);
  });
});
