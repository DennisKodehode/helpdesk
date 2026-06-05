import { Role } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import InviteAgentDialog from "./InviteAgentDialog";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(canInviteAdmins = true) {
  const onOpenChange = vi.fn();
  const onInvited = vi.fn();
  renderWithProviders(
    <InviteAgentDialog
      open
      onOpenChange={onOpenChange}
      onInvited={onInvited}
      canInviteAdmins={canInviteAdmins}
    />,
  );
  return { onOpenChange, onInvited };
}

describe("InviteAgentDialog", () => {
  it("renders the fields when open", () => {
    setup();
    expect(screen.getByText("Invite an agent")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toBeInTheDocument();
  });

  it("blocks submit and shows validation when the name is too short", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Work email"), "jordan@example.com");
    await user.click(screen.getByRole("button", { name: /send invite/i }));
    expect(await screen.findByText(/name must be at least 3/i)).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Full name"), "Jordan Ellis");
    await user.type(screen.getByLabelText("Work email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /send invite/i }));
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("posts the invite and reports success", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: "x" } });
    const user = userEvent.setup();
    const { onInvited, onOpenChange } = setup();
    await user.type(screen.getByLabelText("Full name"), "Jordan Ellis");
    await user.type(screen.getByLabelText("Work email"), "jordan@example.com");
    await user.click(screen.getByRole("button", { name: /send invite/i }));
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        "/api/users",
        expect.objectContaining({
          name: "Jordan Ellis",
          email: "jordan@example.com",
          role: Role.agent,
        }),
      ),
    );
    expect(onInvited).toHaveBeenCalledWith("jordan@example.com");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("swaps the role caption when Admin is selected (global admin)", async () => {
    const user = userEvent.setup();
    setup(true);
    expect(screen.getByText(/can triage, reply to, and resolve/i)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Admin" }));
    expect(screen.getByText(/can manage agents and sla targets/i)).toBeInTheDocument();
  });

  it("hides the role picker entirely for a non-global-admin", () => {
    setup(false);
    // No Admin option, and the whole Role selector is gone — a regular admin
    // can only ever invite agents.
    expect(screen.queryByRole("radio", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.queryByText("Role")).not.toBeInTheDocument();
  });

  it("invites as an agent when the role picker is hidden", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: "x" } });
    const user = userEvent.setup();
    setup(false);
    await user.type(screen.getByLabelText("Full name"), "Jordan Ellis");
    await user.type(screen.getByLabelText("Work email"), "jordan@example.com");
    await user.click(screen.getByRole("button", { name: /send invite/i }));
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        "/api/users",
        expect.objectContaining({ role: Role.agent }),
      ),
    );
  });
});
