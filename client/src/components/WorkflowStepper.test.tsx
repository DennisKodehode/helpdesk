import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import WorkflowStepper from "./WorkflowStepper";

afterEach(cleanup);

describe("WorkflowStepper", () => {
  it("increments and decrements within bounds", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <WorkflowStepper
        value={85}
        onChange={onChange}
        min={50}
        max={99}
        suffix="%"
        label="threshold"
      />,
    );
    await user.click(screen.getByRole("button", { name: /Increase threshold/i }));
    expect(onChange).toHaveBeenCalledWith(86);
    await user.click(screen.getByRole("button", { name: /Decrease threshold/i }));
    expect(onChange).toHaveBeenCalledWith(84);
  });

  it("disables the buttons at the bounds", () => {
    const { rerender } = renderWithProviders(
      <WorkflowStepper
        value={50}
        onChange={vi.fn()}
        min={50}
        max={99}
        label="threshold"
      />,
    );
    expect(screen.getByRole("button", { name: /Decrease threshold/i })).toBeDisabled();

    rerender(
      <WorkflowStepper
        value={99}
        onChange={vi.fn()}
        min={50}
        max={99}
        label="threshold"
      />,
    );
    expect(screen.getByRole("button", { name: /Increase threshold/i })).toBeDisabled();
  });

  it("renders the value with its suffix", () => {
    renderWithProviders(
      <WorkflowStepper
        value={7}
        onChange={vi.fn()}
        min={1}
        max={30}
        suffix=" days"
        label="quiet period"
      />,
    );
    expect(screen.getByText("7 days")).toBeInTheDocument();
  });
});
