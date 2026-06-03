import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, within } from "../../test/utils";
import DatePicker from "./DatePicker";

afterEach(cleanup);

describe("DatePicker", () => {
  it("shows the placeholder when no value is set", () => {
    renderWithProviders(<DatePicker value="" ariaLabel="From date" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "From date" })).toHaveTextContent(
      "dd.mm.yyyy",
    );
  });

  it("renders the value as dd.mm.yyyy", () => {
    renderWithProviders(
      <DatePicker value="2026-06-03" ariaLabel="From date" onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "From date" })).toHaveTextContent(
      "03.06.2026",
    );
  });

  it("opens the calendar and emits an ISO date when a day is picked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <DatePicker value="2026-06-10" ariaLabel="From date" onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "From date" }));
    const grid = await screen.findByRole("grid");
    // Match by visible day number — robust to react-day-picker's aria-label text.
    const day15 = within(grid)
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "15");
    if (!day15) throw new Error("day 15 not found in calendar");
    await user.click(day15);

    expect(onChange).toHaveBeenCalledWith("2026-06-15");
  });

  it("clears the value via the Clear action", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <DatePicker value="2026-06-10" ariaLabel="From date" onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "From date" }));
    await user.click(await screen.findByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("disables days outside the min/max range", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DatePicker
        value="2026-06-10"
        ariaLabel="From date"
        min="2026-06-05"
        max="2026-06-20"
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "From date" }));
    const grid = await screen.findByRole("grid");
    const day1 = within(grid)
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "1");
    expect(day1).toBeDisabled();
  });
});
