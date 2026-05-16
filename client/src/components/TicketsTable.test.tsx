import { describe, it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, within, cleanup } from "../test/utils";
import TicketsTable from "./TicketsTable";
import { TicketStatus, TicketCategory, TicketPriority, type Ticket } from "@helpdesk/core";

afterEach(cleanup);

const mockTickets: Ticket[] = [
  {
    id: 1,
    fromName: "Alice Smith",
    fromEmail: "alice@example.com",
    subject: "My printer is on fire",
    status: TicketStatus.open,
    category: TicketCategory.technical_question,
    priority: TicketPriority.urgent,
    assignedToId: null,
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
    createdAt: "2024-03-20T00:00:00Z",
  },
];

const defaultProps = {
  tickets: mockTickets,
  isPending: false,
  isError: false,
  sorting: [{ id: "createdAt", desc: true }],
  onSortingChange: vi.fn(),
};

describe("loading state", () => {
  it("shows skeleton rows while pending and hides ticket data", () => {
    renderWithProviders(<TicketsTable {...defaultProps} tickets={[]} isPending />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
  });
});

describe("error state", () => {
  it("shows an error message", () => {
    renderWithProviders(<TicketsTable {...defaultProps} tickets={[]} isError />);
    expect(screen.getByText("Failed to load tickets")).toBeInTheDocument();
  });
});

describe("empty state", () => {
  it("shows 'No tickets yet' when the list is empty", () => {
    renderWithProviders(<TicketsTable {...defaultProps} tickets={[]} />);
    // Empty state is rendered in both the desktop table and the mobile card list.
    expect(screen.getAllByText("No tickets yet").length).toBeGreaterThan(0);
  });
});

describe("loaded state", () => {
  it("renders a row for each ticket", () => {
    renderWithProviders(<TicketsTable {...defaultProps} />);
    const table = within(screen.getByRole("table"));
    expect(table.getByText("My printer is on fire")).toBeInTheDocument();
    expect(table.getByText("Alice Smith")).toBeInTheDocument();
    expect(table.getByText("Refund please")).toBeInTheDocument();
  });

  it("renders status and category badges", () => {
    renderWithProviders(<TicketsTable {...defaultProps} />);
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Open")).toBeInTheDocument();
    expect(table.getByText("Technical")).toBeInTheDocument();
    expect(table.getByText("Refund")).toBeInTheDocument();
  });

  it("renders the priority badge with the matching label", () => {
    renderWithProviders(<TicketsTable {...defaultProps} />);
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Urgent")).toBeInTheDocument();
    expect(table.getByText("Normal")).toBeInTheDocument();
  });

  it("renders a dash for a ticket with no category", () => {
    const ticket: Ticket = { ...mockTickets[0], category: null };
    renderWithProviders(<TicketsTable {...defaultProps} tickets={[ticket]} />);
    // The dash only renders in the desktop table cell; mobile card omits the badge entirely.
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("sorting", () => {
  it("renders all 6 column headers", () => {
    renderWithProviders(<TicketsTable {...defaultProps} />);
    expect(screen.getByRole("columnheader", { name: /subject/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /from/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /category/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /priority/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /received/i })).toBeInTheDocument();
  });

  it("calls onSortingChange when a column header is clicked", async () => {
    const user = userEvent.setup();
    const onSortingChange = vi.fn();
    renderWithProviders(
      <TicketsTable {...defaultProps} sorting={[]} onSortingChange={onSortingChange} />
    );
    await user.click(screen.getByRole("columnheader", { name: /subject/i }));
    expect(onSortingChange).toHaveBeenCalledOnce();
  });
});
