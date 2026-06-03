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
import TabletTicketListPane from "./TabletTicketListPane";

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
  {
    id: 2,
    fromName: "Bob Jones",
    fromEmail: "bob@example.com",
    subject: "Refund please",
    status: TicketStatus.resolved,
    category: TicketCategory.refund_request,
    priority: TicketPriority.normal,
    assignedToId: null,
    assigneeType: "none",
    isSuppressed: false,
    firstAgentReplyAt: null,
    resolvedAt: null,
    createdAt: "2024-03-20T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: { data: tickets, total: 2 } });
});

describe("TabletTicketListPane", () => {
  it("renders a card per ticket with subject and case id", async () => {
    renderWithProviders(
      <TabletTicketListPane scope="all" selectedId={undefined} onSelect={vi.fn()} />,
    );
    expect(await screen.findByText("My printer is on fire")).toBeInTheDocument();
    expect(screen.getByText("Refund please")).toBeInTheDocument();
    expect(screen.getByText(/2 shown/i)).toBeInTheDocument();
  });

  it("calls onSelect with the ticket id when a card is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TabletTicketListPane scope="all" selectedId={undefined} onSelect={onSelect} />,
    );
    await user.click(await screen.findByText("My printer is on fire"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("shows the view chips for the all scope", async () => {
    renderWithProviders(
      <TabletTicketListPane scope="all" selectedId={undefined} onSelect={vi.fn()} />,
    );
    expect(
      await screen.findByRole("button", { name: /show all tickets/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show unassigned tickets/i }),
    ).toBeInTheDocument();
  });

  it("hides the view chips and requests assignee=me for the mine scope", async () => {
    renderWithProviders(
      <TabletTicketListPane scope="mine" selectedId={undefined} onSelect={vi.fn()} />,
    );
    await screen.findByText("My printer is on fire");
    expect(
      screen.queryByRole("button", { name: /show unassigned tickets/i }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/tickets",
        expect.objectContaining({
          params: expect.objectContaining({ assignee: "me" }),
        }),
      );
    });
  });

  it("shows an empty state when there are no tickets", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: [], total: 0 } });
    renderWithProviders(
      <TabletTicketListPane scope="all" selectedId={undefined} onSelect={vi.fn()} />,
    );
    expect(await screen.findByText(/nothing here/i)).toBeInTheDocument();
  });
});
