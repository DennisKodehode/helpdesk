import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders, screen, cleanup } from "../test/utils";
import Sidebar from "./Sidebar";
import { useSession } from "@/lib/auth-client";
import { Role } from "@helpdesk/core";

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
});

describe("Sidebar", () => {
  it("renders primary nav links for any signed-in user", () => {
    mockSession(Role.agent);
    renderWithProviders(
      <Sidebar mobileOpen={false} onMobileOpenChange={vi.fn()} />
    );
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tickets/i })).toBeInTheDocument();
  });

  it("does not render the Agents link for non-admins", () => {
    mockSession(Role.agent);
    renderWithProviders(
      <Sidebar mobileOpen={false} onMobileOpenChange={vi.fn()} />
    );
    expect(screen.queryByRole("link", { name: /agents/i })).not.toBeInTheDocument();
  });

  it("renders the Agents link for admins", () => {
    mockSession(Role.admin);
    renderWithProviders(
      <Sidebar mobileOpen={false} onMobileOpenChange={vi.fn()} />
    );
    expect(screen.getByRole("link", { name: /agents/i })).toBeInTheDocument();
  });

  it("does not mount the mobile drawer when closed", () => {
    mockSession(Role.agent);
    renderWithProviders(
      <Sidebar mobileOpen={false} onMobileOpenChange={vi.fn()} />
    );
    expect(screen.queryByRole("dialog", { name: /navigation/i })).not.toBeInTheDocument();
  });

  it("mounts the mobile drawer with role=dialog when open", async () => {
    mockSession(Role.agent);
    renderWithProviders(
      <Sidebar mobileOpen={true} onMobileOpenChange={vi.fn()} />
    );
    expect(await screen.findByRole("dialog", { name: /navigation/i })).toBeInTheDocument();
  });
});
