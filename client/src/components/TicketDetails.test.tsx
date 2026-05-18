import {
  TicketCategory,
  type TicketDetail,
  TicketPriority,
  TicketStatus,
} from "@helpdesk/core";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import TicketDetails from "./TicketDetails";

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

describe("TicketDetails", () => {
  it("renders the ticket subject as a heading", () => {
    renderWithProviders(<TicketDetails ticket={mockTicket} />);
    expect(
      screen.getByRole("heading", { name: "My printer is on fire" }),
    ).toBeInTheDocument();
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

  it("does not render the suppression pill when isSuppressed is false", () => {
    renderWithProviders(<TicketDetails ticket={mockTicket} />);
    expect(screen.queryByText(/undeliverable/i)).not.toBeInTheDocument();
  });

  it("renders the suppression pill when isSuppressed is true", () => {
    renderWithProviders(<TicketDetails ticket={{ ...mockTicket, isSuppressed: true }} />);
    expect(screen.getByText(/undeliverable/i)).toBeInTheDocument();
  });
});
