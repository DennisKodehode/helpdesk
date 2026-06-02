import { AuditEventType, type RosterAgent } from "@helpdesk/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderWithProviders, screen } from "../test/utils";
import ActivityFilters from "./ActivityFilters";

const ACTORS = [
  { id: "u1", name: "Alice Agent" },
  { id: "u2", name: "Bob Admin" },
] as RosterAgent[];

function setup(overrides: Partial<Parameters<typeof ActivityFilters>[0]> = {}) {
  const handlers = {
    onTypeChange: vi.fn(),
    onActorChange: vi.fn(),
    onFromChange: vi.fn(),
    onToChange: vi.fn(),
  };
  renderWithProviders(
    <ActivityFilters
      type=""
      actorId=""
      from=""
      to=""
      actors={ACTORS}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ActivityFilters", () => {
  it("shows the default 'all' labels when no filters are set", () => {
    setup();
    expect(screen.getByText("All actors")).toBeInTheDocument();
    expect(screen.getByText("All events")).toBeInTheDocument();
  });

  it("reflects the selected actor and event-type labels", () => {
    setup({ actorId: "ai", type: AuditEventType.status_changed });
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Status changed")).toBeInTheDocument();
  });

  it("calls the date change handlers when the date inputs change", () => {
    const handlers = setup();
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-05-01" },
    });
    expect(handlers.onFromChange).toHaveBeenCalledWith("2026-05-01");

    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-05-31" },
    });
    expect(handlers.onToChange).toHaveBeenCalledWith("2026-05-31");
  });
});
