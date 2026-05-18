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
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T11:00:00Z",
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
        author: { id: "agent-1", name: "Bob Agent" },
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

  it("strips event handler attributes from reply body HTML", async () => {
    const replies: Reply[] = [
      {
        id: 1,
        ticketId: 42,
        senderType: SenderType.customer,
        body: '<img src="x" onerror="window.__xss=1"> Safe reply',
        bodyHtml: null,
        author: null,
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

  it("renders internal notes with an Internal label", async () => {
    const replies: Reply[] = [
      {
        id: 1,
        ticketId: 42,
        senderType: SenderType.internal_note,
        body: "FYI — called this customer earlier, they're frustrated.",
        bodyHtml: null,
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
    expect(within(thread).getByText("Internal")).toBeInTheDocument();
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
});
