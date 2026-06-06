import { AuditEventType, type RosterAgent } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
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
    onClearAll: vi.fn(),
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

  it("renders the date pickers and shows provided values as dd.mm.yyyy", () => {
    setup({ from: "2026-05-01", to: "2026-05-31" });
    expect(screen.getByRole("button", { name: "From date" })).toHaveTextContent(
      "01.05.2026",
    );
    expect(screen.getByRole("button", { name: "To date" })).toHaveTextContent(
      "31.05.2026",
    );
  });

  it("hides the Clear filters button when no filter is set", () => {
    setup();
    expect(
      screen.queryByRole("button", { name: /clear filters/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Clear filters when a filter is active and calls onClearAll", async () => {
    const user = userEvent.setup();
    const handlers = setup({ actorId: "u1" });
    const clear = screen.getByRole("button", { name: /clear filters/i });
    await user.click(clear);
    expect(handlers.onClearAll).toHaveBeenCalledTimes(1);
  });
});
