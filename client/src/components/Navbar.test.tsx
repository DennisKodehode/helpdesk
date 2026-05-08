import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import Navbar from "./Navbar";
import { signOut, useSession } from "../lib/auth-client";
import { Role } from "@helpdesk/core";

const mockNavigate = vi.fn();

vi.mock("../lib/auth-client", () => ({
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>();
  return { ...mod, useNavigate: () => mockNavigate };
});

const mockUseSession = useSession as ReturnType<typeof vi.fn>;

function mockSession(role: string, name = "Alice Smith") {
  mockUseSession.mockReturnValue({
    data: { user: { name, role } },
    isPending: false,
  } as unknown as ReturnType<typeof useSession>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(signOut).mockResolvedValue(undefined as never);
});

afterEach(cleanup);

describe("Navbar", () => {
  it("renders the Helpdesk logo link", () => {
    mockSession(Role.agent);
    renderWithProviders(<Navbar />);
    expect(screen.getByRole("link", { name: "Helpdesk" })).toBeInTheDocument();
  });

  it("renders the Tickets link", () => {
    mockSession(Role.agent);
    renderWithProviders(<Navbar />);
    expect(screen.getByRole("link", { name: "Tickets" })).toBeInTheDocument();
  });

  it("shows the signed-in user's name", () => {
    mockSession(Role.agent, "Bob Jones");
    renderWithProviders(<Navbar />);
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("does not show the Users link for agents", () => {
    mockSession(Role.agent);
    renderWithProviders(<Navbar />);
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });

  it("shows the Users link for admins", () => {
    mockSession(Role.admin);
    renderWithProviders(<Navbar />);
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
  });

  it("calls signOut and navigates to /login when Sign out is clicked", async () => {
    mockSession(Role.agent);
    const user = userEvent.setup();
    renderWithProviders(<Navbar />);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });
});
