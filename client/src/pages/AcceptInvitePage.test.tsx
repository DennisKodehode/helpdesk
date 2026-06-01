import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import AcceptInvitePage from "./AcceptInvitePage";

const { navigate, signInEmail } = vi.hoisted(() => ({
  navigate: vi.fn(),
  signInEmail: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), isAxiosError: vi.fn() },
}));
vi.mock("@/lib/auth-client", () => ({ signIn: { email: signInEmail } }));
vi.mock("react-router", async (orig) => ({
  ...(await orig<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function render(token = "tok123") {
  return renderWithProviders(<AcceptInvitePage />, {
    initialEntries: [`/accept-invite?token=${token}`],
  });
}

describe("AcceptInvitePage", () => {
  it("greets the invitee when the token is valid", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { name: "Jordan Ellis", email: "jordan@example.com" },
    });
    render();
    expect(await screen.findByText(/welcome, jordan/i)).toBeInTheDocument();
    expect(screen.getByText(/jordan@example\.com/)).toBeInTheDocument();
  });

  it("shows the expired state for an invalid token", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("bad token"));
    render();
    expect(await screen.findByText(/invitation expired/i)).toBeInTheDocument();
  });

  it("shows the expired state when there is no token", async () => {
    render("");
    expect(await screen.findByText(/invitation expired/i)).toBeInTheDocument();
  });

  it("accepts, signs in, and navigates to the dashboard on submit", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { name: "Jordan", email: "jordan@example.com" },
    });
    vi.mocked(axios.post).mockResolvedValue({ data: { email: "jordan@example.com" } });
    signInEmail.mockResolvedValue({});
    const user = userEvent.setup();
    render();
    await screen.findByText(/welcome/i);
    await user.type(screen.getByLabelText("Password"), "newpassword1");
    await user.click(screen.getByRole("button", { name: /set password & sign in/i }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith("/api/invites/accept", {
        token: "tok123",
        password: "newpassword1",
      }),
    );
    await waitFor(() =>
      expect(signInEmail).toHaveBeenCalledWith({
        email: "jordan@example.com",
        password: "newpassword1",
      }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });
});
