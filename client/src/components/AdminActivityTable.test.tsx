import { AdminAuditEventType, type AdminAuditRow } from "@helpdesk/core";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import AdminActivityTable from "./AdminActivityTable";

function row(
  over: Partial<AdminAuditRow> & Pick<AdminAuditRow, "id" | "type">,
): AdminAuditRow {
  return {
    actorName: "Owner",
    targetUserId: null,
    targetName: "Jordan",
    data: {},
    createdAt: new Date().toISOString(),
    ...over,
  };
}

const ROWS: AdminAuditRow[] = [
  row({
    id: "a1",
    type: AdminAuditEventType.user_role_changed,
    data: { from: "agent", to: "admin" },
  }),
  row({ id: "a2", type: AdminAuditEventType.user_deactivated, targetName: "Sam" }),
  row({
    id: "a3",
    type: AdminAuditEventType.sla_targets_changed,
    targetName: "SLA · urgent",
    targetUserId: null,
  }),
];

afterEach(cleanup);

describe("AdminActivityTable", () => {
  it("renders a summary + target per admin event", () => {
    renderWithProviders(
      <AdminActivityTable events={ROWS} isPending={false} isError={false} />,
    );
    expect(
      screen.getByText(/Owner changed Jordan's role agent → admin/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Owner deactivated Sam/i)).toBeInTheDocument();
    expect(screen.getByText(/Owner changed SLA · urgent targets/i)).toBeInTheDocument();
    // Target column shows the affected user / config area.
    expect(screen.getByText("Sam")).toBeInTheDocument();
  });

  it("flags a password reset without ever rendering a password", () => {
    renderWithProviders(
      <AdminActivityTable
        events={[
          row({
            id: "e1",
            type: AdminAuditEventType.user_edited,
            data: { fields: ["email"], passwordReset: true },
          }),
        ]}
        isPending={false}
        isError={false}
      />,
    );
    expect(
      screen.getByText(/Owner edited Jordan \(password reset\)/i),
    ).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    renderWithProviders(
      <AdminActivityTable events={[]} isPending={false} isError={false} />,
    );
    expect(
      screen.getByText(/no admin activity matches these filters/i),
    ).toBeInTheDocument();
  });

  it("shows an error alert on failure", () => {
    renderWithProviders(
      <AdminActivityTable events={[]} isPending={false} isError={true} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/failed to load admin activity/i);
  });
});
