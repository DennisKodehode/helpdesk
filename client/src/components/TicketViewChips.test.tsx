import { TicketView } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import TicketViewChips from "./TicketViewChips";

afterEach(cleanup);

describe("TicketViewChips", () => {
  it("renders all three view chips with their labels", () => {
    renderWithProviders(<TicketViewChips activeView={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /unassigned/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /triage/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /awaiting a customer response/i }),
    ).toBeInTheDocument();
  });

  it("marks the active chip with aria-pressed=true and others false", () => {
    renderWithProviders(
      <TicketViewChips activeView={TicketView.triage} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /unassigned/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /triage/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /awaiting a customer response/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking an inactive chip calls onChange with that view key", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TicketViewChips activeView={null} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /unassigned/i }));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toBe(TicketView.unassigned);
  });

  it("clicking the active chip calls onChange(null)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TicketViewChips activeView={TicketView.awaiting_customer} onChange={onChange} />,
    );
    await user.click(
      screen.getByRole("button", { name: /awaiting a customer response/i }),
    );
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toBeNull();
  });
});
