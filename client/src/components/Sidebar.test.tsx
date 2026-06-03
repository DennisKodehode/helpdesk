import { Role } from "@helpdesk/core";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@/lib/auth-client";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import Sidebar from "./Sidebar";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

afterEach(cleanup);

function mockSession(role: string) {
  vi.mocked(useSession).mockReturnValue({
    data: {
      user: { name: "Test User", email: "test@example.com", role },
    },
    isPending: false,
  } as unknown as ReturnType<typeof useSession>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: { count: 0 } });
});

describe("Sidebar", () => {
  it("renders primary nav links for any signed-in user", () => {
    mockSession(Role.agent);
    renderWithProviders(<Sidebar />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^tickets$/i })).toBeInTheDocument();
  });

  it("does not render the Agents link for non-admins", () => {
    mockSession(Role.agent);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByRole("link", { name: /agents/i })).not.toBeInTheDocument();
  });

  it("renders the Agents link for admins", () => {
    mockSession(Role.admin);
    renderWithProviders(<Sidebar />);
    expect(screen.getByRole("link", { name: /agents/i })).toBeInTheDocument();
  });

  it("renders the My tickets link for agents", () => {
    mockSession(Role.agent);
    renderWithProviders(<Sidebar />);
    expect(screen.getByRole("link", { name: /my tickets/i })).toBeInTheDocument();
  });

  it("does not render the My tickets link for admins", () => {
    mockSession(Role.admin);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByRole("link", { name: /my tickets/i })).not.toBeInTheDocument();
  });

  it("renders the open-count badge on the My tickets link for agents", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { count: 5 } });
    mockSession(Role.agent);
    renderWithProviders(<Sidebar />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /my tickets/i });
      expect(link).toHaveTextContent("5");
    });
    expect(axios.get).toHaveBeenCalledWith(
      "/api/tickets/my-open-count",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("renders the My stats link for agents", () => {
    mockSession(Role.agent);
    renderWithProviders(<Sidebar />);
    expect(screen.getByRole("link", { name: /my stats/i })).toBeInTheDocument();
  });

  it("does not render the My stats link for admins", () => {
    mockSession(Role.admin);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByRole("link", { name: /my stats/i })).not.toBeInTheDocument();
  });
});
