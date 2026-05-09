import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import axios from "axios";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import TicketDetails from "./TicketDetails";
import { TicketStatus, TicketCategory, type TicketDetail } from "@helpdesk/core";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), isAxiosError: vi.fn() },
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const mockTicket: TicketDetail = {
  id: 42,
  fromName: "Alice Smith",
  fromEmail: "alice@example.com",
  subject: "My printer is on fire",
  body: "It started smoking and then caught fire.",
  bodyHtml: null,
  status: TicketStatus.open,
  category: TicketCategory.technical_question,
  assignedToId: null,
  assignedTo: null,
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T11:00:00Z",
};

describe("TicketDetails", () => {
  it("renders the ticket subject as a heading", () => {
    renderWithProviders(<TicketDetails ticket={mockTicket} />);
    expect(screen.getByRole("heading", { name: "My printer is on fire" })).toBeInTheDocument();
  });

  it("renders from name and email", () => {
    renderWithProviders(<TicketDetails ticket={mockTicket} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("renders the body content", () => {
    renderWithProviders(<TicketDetails ticket={mockTicket} />);
    expect(screen.getByText("It started smoking and then caught fire.")).toBeInTheDocument();
  });

  it("shows fallback text when body is empty", () => {
    renderWithProviders(<TicketDetails ticket={{ ...mockTicket, body: "" }} />);
    expect(screen.getByText("(no message body)")).toBeInTheDocument();
  });

  it("strips script tags from HTML body", () => {
    const body = "<script>window.__xss=1</script><p>Safe content</p>";
    renderWithProviders(<TicketDetails ticket={{ ...mockTicket, body }} />);
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("Safe content")).toBeInTheDocument();
  });

  it("renders a Summarize button", () => {
    renderWithProviders(<TicketDetails ticket={mockTicket} />);
    expect(screen.getByRole("button", { name: /summarize/i })).toBeInTheDocument();
  });

  it("calls POST /api/tickets/:id/summarize when Summarize is clicked", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { summary: "A summary." } });
    const user = userEvent.setup();
    renderWithProviders(<TicketDetails ticket={mockTicket} />);

    await user.click(screen.getByRole("button", { name: /summarize/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/tickets/42/summarize");
    });
  });

  it("displays the summary after a successful request", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { summary: "The printer caught fire and the agent is investigating." } });
    const user = userEvent.setup();
    renderWithProviders(<TicketDetails ticket={mockTicket} />);

    await user.click(screen.getByRole("button", { name: /summarize/i }));

    expect(await screen.findByText("The printer caught fire and the agent is investigating.")).toBeInTheDocument();
  });

  it("shows an error alert when the summarize request fails", async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderWithProviders(<TicketDetails ticket={mockTicket} />);

    await user.click(screen.getByRole("button", { name: /summarize/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("disables the button and shows Summarizing… while the request is pending", async () => {
    vi.mocked(axios.post).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<TicketDetails ticket={mockTicket} />);

    await user.click(screen.getByRole("button", { name: /summarize/i }));

    const button = screen.getByRole("button", { name: /summarizing/i });
    expect(button).toBeDisabled();
  });
});
