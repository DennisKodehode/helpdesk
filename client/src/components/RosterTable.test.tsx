import { Role, type RosterAgent, UserStatus } from "@helpdesk/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, within } from "../test/utils";
import RosterTable from "./RosterTable";

function agent(
  overrides: Partial<RosterAgent> & Pick<RosterAgent, "id" | "role">,
): RosterAgent {
  return {
    name: `User ${overrides.id}`,
    email: `${overrides.id}@example.com`,
    status: UserStatus.active,
    openAssigned: 0,
    resolved30d: 0,
    avgResolutionMinutes: null,
    lastActiveAt: null,
    ...overrides,
  } as RosterAgent;
}

const ROSTER: RosterAgent[] = [
  agent({ id: "a1", role: Role.agent }),
  agent({ id: "ad1", role: Role.admin }),
  agent({ id: "g1", role: Role.globalAdmin }),
];

function render(viewerIsGlobalAdmin: boolean) {
  return renderWithProviders(
    <RosterTable
      roster={ROSTER}
      isPending={false}
      isError={false}
      onRoleChange={vi.fn()}
      onAction={vi.fn()}
      viewerIsGlobalAdmin={viewerIsGlobalAdmin}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RosterTable role gating", () => {
  // Scope to the desktop <table> — the component also renders mobile cards, so
  // unscoped queries would double every match.
  const table = () => within(screen.getByRole("table"));

  it("renders the Global admin label", () => {
    render(false);
    expect(table().getByText("Global admin")).toBeInTheDocument();
  });

  it("marks the protected owner row with an OWNER affordance (no empty cell)", () => {
    render(true); // even the global admin can't act on the owner row
    expect(table().getByText("Owner")).toBeInTheDocument();
  });

  it("for a regular admin: controls are visible but disabled where not permitted", () => {
    render(false);
    // Role: agent + admin rows show a (disabled) dropdown; the owner row is a
    // static badge with no control.
    const roleButtons = table().getAllByLabelText("Change role");
    expect(roleButtons).toHaveLength(2);
    for (const b of roleButtons) expect(b).toBeDisabled();
    // Actions: agent row enabled (any admin manages agents), admin row disabled;
    // owner row shows the OWNER marker (no button). DOM order: agent, admin.
    const actionButtons = table().getAllByLabelText("Agent actions");
    expect(actionButtons).toHaveLength(2);
    expect(actionButtons[0]).toBeEnabled(); // agent row
    expect(actionButtons[1]).toBeDisabled(); // admin row
  });

  it("for the global admin: agent + admin rows are fully interactive, owner row locked", () => {
    render(true);
    const roleButtons = table().getAllByLabelText("Change role");
    expect(roleButtons).toHaveLength(2);
    for (const b of roleButtons) expect(b).toBeEnabled();
    const actionButtons = table().getAllByLabelText("Agent actions");
    expect(actionButtons).toHaveLength(2);
    for (const b of actionButtons) expect(b).toBeEnabled();
  });
});
