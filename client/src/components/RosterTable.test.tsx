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

  it("for a regular admin: no role is editable, only the agent row is actionable", () => {
    render(false);
    // No interactive role menus at all — a regular admin can't change any role.
    expect(table().queryAllByLabelText("Change role")).toHaveLength(0);
    // Only the agent row exposes the actions menu (admin + global-admin locked).
    expect(table().getAllByLabelText("Agent actions")).toHaveLength(1);
  });

  it("for the global admin: agent + admin rows are editable/actionable, the owner row is locked", () => {
    render(true);
    // Agent + admin rows get an interactive role menu; the global-admin row does not.
    expect(table().getAllByLabelText("Change role")).toHaveLength(2);
    // Agent + admin rows get actions; the global-admin (owner) row stays locked.
    expect(table().getAllByLabelText("Agent actions")).toHaveLength(2);
  });
});
