import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, waitFor, cleanup, renderWithProviders } from "../test/utils";
import userEvent from "@testing-library/user-event";
import LoginPage from "./LoginPage";
import { signIn, useSession } from "../lib/auth-client";

const mockNavigate = vi.fn();

vi.mock("../lib/auth-client", () => ({
  signIn: { email: vi.fn() },
  useSession: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>();
  return { ...mod, useNavigate: () => mockNavigate };
});

const mockSignIn = signIn.email as ReturnType<typeof vi.fn>;
const mockUseSession = useSession as ReturnType<typeof vi.fn>;

function renderLogin() {
  return renderWithProviders(<LoginPage />);
}

afterEach(cleanup);
beforeEach(() => {
  mockSignIn.mockReset();
  mockNavigate.mockReset();
  mockUseSession.mockReturnValue({ data: null, isPending: false });
});

describe("session redirect", () => {
  it("redirects to / when a session is already active", () => {
    mockUseSession.mockReturnValue({ data: { user: {} }, isPending: false });
    renderLogin();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });
});

describe("successful sign-in", () => {
  it("calls signIn.email with credentials and navigates to / on success", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith({ email: "user@example.com", password: "secret123" }));
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });
});

describe("server errors", () => {
  it("shows the error message returned by signIn", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
  });

  it("shows 'Invalid credentials' fallback when error has no message", async () => {
    mockSignIn.mockResolvedValue({ error: {} });
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
  });
});
