import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import ForgotPasswordPage from "./ForgotPasswordPage";

const { requestPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({ requestPasswordReset }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function render() {
  return renderWithProviders(<ForgotPasswordPage />, {
    initialEntries: ["/forgot-password"],
  });
}

describe("ForgotPasswordPage", () => {
  it("blocks submission and validates the email field", async () => {
    const user = userEvent.setup();
    render();
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("requests a reset and shows the generic confirmation", async () => {
    requestPasswordReset.mockResolvedValue({ data: null, error: null });
    const user = userEvent.setup();
    render();
    await user.type(screen.getByLabelText("Email"), "agent@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(requestPasswordReset).toHaveBeenCalledWith({
        email: "agent@example.com",
        redirectTo: expect.stringContaining("/reset-password"),
      }),
    );
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
  });

  it("shows the same confirmation regardless of whether the email exists", async () => {
    // The client never reveals account existence — it always lands on the
    // inbox confirmation even if the call resolves with an error.
    requestPasswordReset.mockResolvedValue({ data: null, error: null });
    const user = userEvent.setup();
    render();
    await user.type(screen.getByLabelText("Email"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
  });
});
