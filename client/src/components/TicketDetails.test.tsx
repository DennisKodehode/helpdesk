import { describe, it, expect, afterEach } from "vitest";
import { renderWithProviders, screen, cleanup } from "../test/utils";
import TicketDetails from "./TicketDetails";
import { TicketStatus, TicketCategory, type TicketDetail } from "@helpdesk/core";

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
});
