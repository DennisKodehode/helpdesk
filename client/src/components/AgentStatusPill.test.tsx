import { UserStatus } from "@helpdesk/core";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import AgentStatusPill from "./AgentStatusPill";

afterEach(cleanup);

describe("AgentStatusPill", () => {
  it.each([
    [UserStatus.active, "Active"],
    [UserStatus.invited, "Invited"],
    [UserStatus.inactive, "Inactive"],
  ])("renders the %s label", (status, label) => {
    renderWithProviders(<AgentStatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
