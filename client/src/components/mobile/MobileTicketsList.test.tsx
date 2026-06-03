import {
  type Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../../test/utils";
import MobileTicketsList from "./MobileTicketsList";

const navigateMock = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});

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

const tickets: Ticket[] = [
  {
    id: 1,
    fromName: "Alice Smith",
    fromEmail: "alice@example.com",
    subject: "My printer is on fire",
    status: TicketStatus.open,
    category: TicketCategory.technical_question,
    priority: TicketPriority.urgent,
    assignedToId: null,
    assigneeType: "none",
    isSuppressed: false,
    firstAgentReplyAt: null,
    resolvedAt: null,
    createdAt: "2024-01-15T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: { data: tickets, total: 1 } });
});

describe("MobileTicketsList", () => {
  it("renders ticket cards and the view chips for the all scope", async () => {
    renderWithProviders(<MobileTicketsList scope="all" />);
    expect(await screen.findByText("My printer is on fire")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show all tickets/i })).toBeInTheDocument();
    expect(screen.getByText(/1 shown/i)).toBeInTheDocument();
  });

  it("navigates to the ticket on tap", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileTicketsList scope="all" />);
    await user.click(await screen.findByText("My printer is on fire"));
    expect(navigateMock).toHaveBeenCalledWith("/tickets/1");
  });

  it("hides chips and requests assignee=me for the mine scope", async () => {
    renderWithProviders(<MobileTicketsList scope="mine" />);
    await screen.findByText("My printer is on fire");
    expect(
      screen.queryByRole("button", { name: /show all tickets/i }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/tickets",
        expect.objectContaining({ params: expect.objectContaining({ assignee: "me" }) }),
      );
    });
  });

  it("shows the empty state when there are no tickets", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: [], total: 0 } });
    renderWithProviders(<MobileTicketsList scope="all" />);
    expect(await screen.findByText(/nothing in this view/i)).toBeInTheDocument();
  });
});
