import {
  type Reply,
  SenderType,
  TicketCategory,
  type TicketDetail,
  TicketPriority,
  TicketStatus,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor, within } from "../test/utils";
import ReplyThread from "./ReplyThread";

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

const mockTicket: TicketDetail = {
  id: 42,
  fromName: "Alice Smith",
  fromEmail: "alice@example.com",
  subject: "My printer is on fire",
  body: "It started smoking and then caught fire.",
  bodyHtml: null,
  status: TicketStatus.open,
  category: TicketCategory.technical_question,
  priority: TicketPriority.normal,
  assignedToId: null,
  assignedTo: null,
  assigneeType: "none",
  isSuppressed: false,
  hasKbSuggestion: false,
  attachments: [],
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T11:00:00Z",
  firstAgentReplyAt: null,
  resolvedAt: null,
};

describe("ReplyThread", () => {
  it("always renders the original message as the first item", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    const thread = await screen.findByRole("list", { name: /reply thread/i });
    expect(
      within(thread).getByText("It started smoking and then caught fire."),
    ).toBeInTheDocument();
  });

  it("labels the original message as Customer", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    const thread = await screen.findByRole("list", { name: /reply thread/i });
    const items = within(thread).getAllByRole("listitem");
    expect(within(items[0]).getByText("Customer")).toBeInTheDocument();
    expect(within(items[0]).getByText("Alice Smith")).toBeInTheDocument();
  });

  it("renders agent replies after the original message", async () => {
    const replies: Reply[] = [
      {
        id: 1,
        ticketId: 42,
        senderType: SenderType.agent,
        body: "We are looking into it.",
        bodyHtml: null,
        isAi: false,
        author: { id: "agent-1", name: "Bob Agent" },
        attachments: [],
        createdAt: "2024-01-15T12:00:00Z",
      },
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: replies });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    const thread = await screen.findByRole("list", { name: /reply thread/i });
    expect(
      await within(thread).findByText("We are looking into it."),
    ).toBeInTheDocument();
    expect(within(thread).getByText("Bob Agent")).toBeInTheDocument();
    expect(within(thread).getAllByText("Agent").length).toBeGreaterThan(0);
  });

  it("renders an AI auto-reply with the 'AI Agent' name and 'AI · auto' label", async () => {
    const replies: Reply[] = [
      {
        id: 1,
        ticketId: 42,
        senderType: SenderType.agent,
        body: "Happy to help! Here is our refund policy.",
        bodyHtml: null,
        // The AI user is a real author, but the server flags the reply as AI.
        author: { id: "ai-user", name: "AI" },
        isAi: true,
        attachments: [],
        createdAt: "2024-01-15T12:00:00Z",
      },
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: replies });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    const thread = await screen.findByRole("list", { name: /reply thread/i });

    expect(
      await within(thread).findByText("Happy to help! Here is our refund policy."),
    ).toBeInTheDocument();
    expect(within(thread).getByText("AI Agent")).toBeInTheDocument();
    expect(within(thread).getByText("AI · auto")).toBeInTheDocument();
    // It must NOT fall back to the plain human-agent label.
    expect(within(thread).queryByText("Agent")).not.toBeInTheDocument();
  });

  it("strips event handler attributes from reply body HTML", async () => {
    const replies: Reply[] = [
      {
        id: 1,
        ticketId: 42,
        senderType: SenderType.customer,
        body: '<img src="x" onerror="window.__xss=1"> Safe reply',
        bodyHtml: null,
        isAi: false,
        author: null,
        attachments: [],
        createdAt: "2024-01-15T12:00:00Z",
      },
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: replies });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    expect(await screen.findByText(/Safe reply/)).toBeInTheDocument();
    expect(document.querySelector("[onerror]")).toBeNull();
  });

  it("renders a Summarize button", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    await screen.findByRole("list", { name: /reply thread/i });
    expect(screen.getByRole("button", { name: /summarize/i })).toBeInTheDocument();
  });

  it("calls POST /api/tickets/:id/summarize when Summarize is clicked", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    vi.mocked(axios.post).mockResolvedValue({ data: { summary: "A summary." } });
    const user = userEvent.setup();
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    await screen.findByRole("list", { name: /reply thread/i });

    await user.click(screen.getByRole("button", { name: /summarize/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/tickets/42/summarize");
    });
  });

  it("displays the summary after a successful request", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    vi.mocked(axios.post).mockResolvedValue({
      data: { summary: "The printer caught fire and the agent is investigating." },
    });
    const user = userEvent.setup();
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    await screen.findByRole("list", { name: /reply thread/i });

    await user.click(screen.getByRole("button", { name: /summarize/i }));

    expect(
      await screen.findByText("The printer caught fire and the agent is investigating."),
    ).toBeInTheDocument();
  });

  it("renders internal notes with an Internal note label", async () => {
    const replies: Reply[] = [
      {
        id: 1,
        ticketId: 42,
        senderType: SenderType.internal_note,
        body: "FYI — called this customer earlier, they're frustrated.",
        bodyHtml: null,
        isAi: false,
        attachments: [],
        author: { id: "agent-1", name: "Bob Agent" },
        createdAt: "2024-01-15T12:00:00Z",
      },
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: replies });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    const thread = await screen.findByRole("list", { name: /reply thread/i });

    expect(
      await within(thread).findByText(
        "FYI — called this customer earlier, they're frustrated.",
      ),
    ).toBeInTheDocument();
    expect(within(thread).getByText("Internal note")).toBeInTheDocument();
    expect(within(thread).getByText("Bob Agent")).toBeInTheDocument();
    expect(within(thread).queryByText("Agent")).not.toBeInTheDocument();
  });

  it("shows an error alert when the summarize request fails", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    vi.mocked(axios.post).mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    await screen.findByRole("list", { name: /reply thread/i });

    await user.click(screen.getByRole("button", { name: /summarize/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("renders an attachment chip for each attachment on a reply", async () => {
    const replies: Reply[] = [
      {
        id: 10,
        ticketId: 42,
        senderType: SenderType.agent,
        body: "Here's the fix.",
        bodyHtml: null,
        isAi: false,
        author: { id: "agent-1", name: "Bob" },
        attachments: [
          {
            id: "att-1",
            filename: "screenshot.png",
            contentType: "image/png",
            size: 2048,
            createdAt: "2024-01-15T12:00:00Z",
          },
          {
            id: "att-2",
            filename: "log.txt",
            contentType: "text/plain",
            size: 500,
            createdAt: "2024-01-15T12:00:00Z",
          },
        ],
        createdAt: "2024-01-15T12:00:00Z",
      },
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: replies });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);

    const attachments = await screen.findByRole("list", { name: /attachments/i });
    expect(within(attachments).getByText("screenshot.png")).toBeInTheDocument();
    expect(within(attachments).getByText("log.txt")).toBeInTheDocument();
    expect(within(attachments).getByText("2 KB")).toBeInTheDocument();
    expect(within(attachments).getByText("500 B")).toBeInTheDocument();
  });

  it("does not render an attachments list when a reply has no attachments", async () => {
    const replies: Reply[] = [
      {
        id: 11,
        ticketId: 42,
        senderType: SenderType.agent,
        body: "No files here.",
        bodyHtml: null,
        isAi: false,
        author: { id: "agent-1", name: "Bob" },
        attachments: [],
        createdAt: "2024-01-15T12:00:00Z",
      },
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: replies });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);

    await screen.findByText("No files here.");
    expect(screen.queryByRole("list", { name: /attachments/i })).not.toBeInTheDocument();
  });

  it("fetches a download URL and opens it in a new tab when a chip is clicked", async () => {
    const replies: Reply[] = [
      {
        id: 12,
        ticketId: 42,
        senderType: SenderType.agent,
        body: "PDF attached.",
        bodyHtml: null,
        isAi: false,
        author: { id: "agent-1", name: "Bob" },
        attachments: [
          {
            id: "att-pdf",
            filename: "report.pdf",
            contentType: "application/pdf",
            size: 5000,
            createdAt: "2024-01-15T12:00:00Z",
          },
        ],
        createdAt: "2024-01-15T12:00:00Z",
      },
    ];
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url === "/api/attachments/att-pdf") return { data: { url: "/files/x.pdf" } };
      return { data: replies };
    });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    renderWithProviders(<ReplyThread ticket={mockTicket} />);

    const chip = await screen.findByRole("button", { name: /report\.pdf/i });
    await user.click(chip);

    expect(axios.get).toHaveBeenCalledWith("/api/attachments/att-pdf");
    await new Promise((r) => setTimeout(r, 0));
    expect(openSpy).toHaveBeenCalledWith("/files/x.pdf", "_blank", "noopener,noreferrer");
    openSpy.mockRestore();
  });

  it("renders chips on the ORIGINAL message when ticket.attachments is non-empty", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    const ticketWithAttachments: TicketDetail = {
      ...mockTicket,
      attachments: [
        {
          id: "att-original",
          filename: "from-the-customer.png",
          contentType: "image/png",
          size: 1024,
          createdAt: "2024-01-15T10:30:00Z",
        },
      ],
    };
    renderWithProviders(<ReplyThread ticket={ticketWithAttachments} />);

    const list = await screen.findByRole("list", { name: /attachments/i });
    expect(within(list).getByText("from-the-customer.png")).toBeInTheDocument();
    expect(within(list).getByText("1 KB")).toBeInTheDocument();
  });
});
