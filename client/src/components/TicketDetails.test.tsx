import { describe, it, expect, afterEach } from "vitest";
import { renderWithProviders, screen, cleanup } from "../test/utils";
import TicketDetails from "./TicketDetails";
import { TicketStatus, TicketCategory, TicketPriority, type TicketDetail } from "@helpdesk/core";

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
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T11:00:00Z",
};

describe("TicketDetails", () => {
  it("renders the ticket subject as a heading", () => {
    renderWithProviders(<TicketDetails ticket={mockTicket} />);
    expect(screen.getByRole("heading", { name: "My printer is on fire" })).toBeInTheDocument();
  });

  it("renders the case number", () => {
    renderWithProviders(<TicketDetails ticket={mockTicket} />);
    expect(screen.getByText(/#0042/)).toBeInTheDocument();
  });

  it("renders sender name and email", () => {
    renderWithProviders(<TicketDetails ticket={mockTicket} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("renders the received timestamp", () => {
    renderWithProviders(<TicketDetails ticket={mockTicket} />);
    expect(screen.getByText(/Received/i)).toBeInTheDocument();
  });
});
