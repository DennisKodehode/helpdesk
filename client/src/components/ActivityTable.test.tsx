import { type AuditEventRow, AuditEventType } from "@helpdesk/core";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import ActivityTable from "./ActivityTable";

const ROWS: AuditEventRow[] = [
  {
    id: "e1",
    type: AuditEventType.status_changed,
    ticketId: 42,
    ticketSubject: "Login broken",
    actorName: "Alice Agent",
    data: {},
    createdAt: new Date().toISOString(),
  },
  {
    id: "e2",
    type: AuditEventType.auto_resolved,
    ticketId: 41,
    ticketSubject: "Refund processed",
    actorName: "AI",
    data: {},
    createdAt: new Date().toISOString(),
  },
  {
    id: "e3",
    type: AuditEventType.ticket_created,
    ticketId: 40,
    ticketSubject: "New request",
    actorName: null,
    data: {},
    createdAt: new Date().toISOString(),
  },
];

afterEach(cleanup);

describe("ActivityTable", () => {
  it("renders a row per event with actor, action, and ticket link", () => {
    renderWithProviders(
      <ActivityTable events={ROWS} isPending={false} isError={false} />,
    );

    expect(screen.getByText("Alice Agent")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    // null actor → "System"
    expect(screen.getByText("System")).toBeInTheDocument();

    expect(screen.getByText(/Alice Agent changed status/i)).toBeInTheDocument();
    expect(screen.getByText(/AI auto-resolved/i)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "#0042" });
    expect(link).toHaveAttribute("href", "/tickets/42");
    expect(screen.getByText("Login broken")).toBeInTheDocument();
  });

  it("shows an empty state when there are no events", () => {
    renderWithProviders(<ActivityTable events={[]} isPending={false} isError={false} />);
    expect(screen.getByText(/no activity matches these filters/i)).toBeInTheDocument();
  });

  it("shows an error alert on failure", () => {
    renderWithProviders(<ActivityTable events={[]} isPending={false} isError={true} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/failed to load activity/i);
  });
});
