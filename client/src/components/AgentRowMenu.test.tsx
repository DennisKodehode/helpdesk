import { UserStatus } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import AgentRowMenu from "./AgentRowMenu";

afterEach(cleanup);

describe("AgentRowMenu", () => {
  it("offers Deactivate + Remove (not Resend) for an active agent", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AgentRowMenu status={UserStatus.active} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: /agent actions/i }));
    expect(
      await screen.findByRole("menuitem", { name: /deactivate/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /remove from team/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /resend invite/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /deactivate/i }));
    expect(onAction).toHaveBeenCalledWith("deactivate");
  });

  it("offers Resend invite (not Deactivate) for an invited agent", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AgentRowMenu status={UserStatus.invited} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: /agent actions/i }));
    expect(
      await screen.findByRole("menuitem", { name: /resend invite/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /deactivate/i }),
    ).not.toBeInTheDocument();
  });

  it("offers Reactivate for an inactive agent", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <AgentRowMenu status={UserStatus.inactive} onAction={onAction} />,
    );
    await user.click(screen.getByRole("button", { name: /agent actions/i }));
    expect(
      await screen.findByRole("menuitem", { name: /reactivate/i }),
    ).toBeInTheDocument();
  });
});
