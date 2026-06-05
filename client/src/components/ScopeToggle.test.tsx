import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import ScopeToggle from "./ScopeToggle";

afterEach(cleanup);

describe("ScopeToggle", () => {
  it("marks the active scope and fires onChange(true) when Archive is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ScopeToggle archived={false} onChange={onChange} />);

    expect(screen.getByRole("tab", { name: "Active" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("tab", { name: "Archive" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("fires onChange(false) when Active is clicked from the Archive scope", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ScopeToggle archived onChange={onChange} />);

    expect(screen.getByRole("tab", { name: "Archive" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("tab", { name: "Active" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
