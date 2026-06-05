import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import ResetPasswordPage from "./ResetPasswordPage";

const { resetPassword } = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({ resetPassword }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function render(search = "?token=tok123") {
  return renderWithProviders(<ResetPasswordPage />, {
    initialEntries: [`/reset-password${search}`],
  });
}

describe("ResetPasswordPage", () => {
  it("shows the expired state when there is no token", () => {
    render("");
    expect(screen.getByText(/link expired/i)).toBeInTheDocument();
  });

  it("shows the expired state when Better Auth redirects with an error", () => {
    render("?error=INVALID_TOKEN");
    expect(screen.getByText(/link expired/i)).toBeInTheDocument();
  });

  it("blocks submission when the passwords do not match", async () => {
    const user = userEvent.setup();
    render();
    await user.type(screen.getByLabelText("New password"), "brandnewpass1");
    await user.type(screen.getByLabelText("Confirm password"), "different9");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("resets the password and shows the success state", async () => {
    resetPassword.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render();
    await user.type(screen.getByLabelText("New password"), "brandnewpass1");
    await user.type(screen.getByLabelText("Confirm password"), "brandnewpass1");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({
        newPassword: "brandnewpass1",
        token: "tok123",
      }),
    );
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });

  it("surfaces a server error from a stale token", async () => {
    resetPassword.mockResolvedValue({
      data: null,
      error: { message: "invalid token" },
    });
    const user = userEvent.setup();
    render();
    await user.type(screen.getByLabelText("New password"), "brandnewpass1");
    await user.type(screen.getByLabelText("Confirm password"), "brandnewpass1");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(await screen.findByText(/invalid token/i)).toBeInTheDocument();
  });
});
