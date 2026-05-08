import { describe, it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import DeleteUserDialog from "./DeleteUserDialog";
import { Role, type User } from "@helpdesk/core";

afterEach(cleanup);

const mockUser: User = {
  id: "2",
  name: "Bob Jones",
  email: "bob@example.com",
  role: Role.agent,
  createdAt: "2024-03-20T00:00:00Z",
};

function renderDialog(overrides: Partial<Parameters<typeof DeleteUserDialog>[0]> = {}) {
  const defaults = {
    deleteTarget: mockUser,
    isDeleting: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };
  return renderWithProviders(<DeleteUserDialog {...defaults} {...overrides} />);
}

describe("DeleteUserDialog", () => {
  it("shows the target user's name and email in the dialog body", () => {
    renderDialog();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText(/bob@example\.com/)).toBeInTheDocument();
  });

  it("does not render when deleteTarget is null", () => {
    renderDialog({ deleteTarget: null });
    expect(screen.queryByRole("heading", { name: /delete user/i })).not.toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onCancel });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onConfirm when Delete is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onConfirm });
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("shows 'Deleting...' and disables buttons while deleting", () => {
    renderDialog({ isDeleting: true });
    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  it("calls onCancel when the dialog is closed externally", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onCancel });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
  });
});
