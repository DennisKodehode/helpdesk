import { Role } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import AgentRoleMenu from "./AgentRoleMenu";

afterEach(cleanup);

describe("AgentRoleMenu", () => {
  it("shows the current role on the trigger", () => {
    renderWithProviders(<AgentRoleMenu role={Role.admin} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /change role/i })).toHaveTextContent(
      "Admin",
    );
  });

  it("opens and fires onChange when a different role is picked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AgentRoleMenu role={Role.agent} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /change role/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Admin" }));
    expect(onChange).toHaveBeenCalledWith(Role.admin);
  });

  it("does not fire onChange when the current role is reselected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AgentRoleMenu role={Role.agent} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /change role/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Agent" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders a read-only Global admin badge (no change-role control)", () => {
    renderWithProviders(
      <AgentRoleMenu role={Role.globalAdmin} onChange={vi.fn()} readOnly />,
    );
    expect(screen.getByText("Global admin")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /change role/i }),
    ).not.toBeInTheDocument();
  });

  it("renders a visible-but-disabled control when disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <AgentRoleMenu
        role={Role.admin}
        onChange={onChange}
        disabled
        disabledTitle="Only a global admin can change roles."
      />,
    );
    const btn = screen.getByRole("button", { name: /change role/i });
    expect(btn).toBeDisabled();
    // Clicking does nothing — no menu, no onChange.
    await user.click(btn).catch(() => {});
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
