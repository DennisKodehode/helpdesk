import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { renderWithProviders, screen, within, cleanup } from "../test/utils";
import ReplyThread from "./ReplyThread";
import { SenderType, TicketStatus, TicketCategory, type TicketDetail, type Reply } from "@helpdesk/core";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), isAxiosError: vi.fn() },
}));

afterEach(cleanup);

const mockTicket: TicketDetail = {
  id: 42,
  fromName: "Alice Smith",
  fromEmail: "alice@example.com",
  subject: "My printer is on fire",
  body: "It started smoking and then caught fire.",
  status: TicketStatus.open,
  category: TicketCategory.technical_question,
  assignedToId: null,
  assignedTo: null,
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T11:00:00Z",
};

describe("ReplyThread", () => {
  it("shows 'No replies yet' when there are no replies", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    expect(await screen.findByText("No replies yet")).toBeInTheDocument();
  });

  it("renders replies from the server", async () => {
    const replies: Reply[] = [
      {
        id: 1,
        ticketId: 42,
        senderType: SenderType.agent,
        body: "We are looking into it.",
        author: { id: "agent-1", name: "Bob Agent" },
        createdAt: "2024-01-15T12:00:00Z",
      },
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: replies });
    renderWithProviders(<ReplyThread ticket={mockTicket} />);
    const thread = await screen.findByRole("list", { name: /reply thread/i });
    expect(within(thread).getByText("We are looking into it.")).toBeInTheDocument();
    expect(within(thread).getByText(/Bob Agent/)).toBeInTheDocument();
  });
});
