import { Role } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@/lib/auth-client";
import { cleanup, renderWithProviders, screen, waitFor } from "../../test/utils";
import TabletIconRail from "./TabletIconRail";

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
    data: { user: { name: "Test User", email: "test@example.com", role } },
    isPending: false,
  } as unknown as ReturnType<typeof useSession>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/tickets/my-open-count")
      return Promise.resolve({ data: { count: 0 } });
    if (url === "/api/notifications")
      return Promise.resolve({ data: { data: [], unreadCount: 0 } });
    return Promise.resolve({ data: {} });
  });
});

describe("TabletIconRail", () => {
  it("shows primary + agent nav for agents and hides admin nav", () => {
    mockSession(Role.agent);
    renderWithProviders(<TabletIconRail />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^tickets$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my tickets/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my stats/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /agents/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /workflow/i })).not.toBeInTheDocument();
  });

  it("shows admin nav and hides the personal queue for admins", () => {
    mockSession(Role.admin);
    renderWithProviders(<TabletIconRail />);
    expect(screen.getByRole("link", { name: /agents/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /workflow/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /activity/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /my tickets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /my stats/i })).not.toBeInTheDocument();
  });

  it("marks the active route with aria-current", () => {
    mockSession(Role.agent);
    renderWithProviders(<TabletIconRail />, { initialEntries: ["/tickets"] });
    expect(screen.getByRole("link", { name: /^tickets$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /dashboard/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders the open-count badge on My tickets for agents", async () => {
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url === "/api/tickets/my-open-count")
        return Promise.resolve({ data: { count: 7 } });
      return Promise.resolve({ data: { data: [], unreadCount: 0 } });
    });
    mockSession(Role.agent);
    renderWithProviders(<TabletIconRail />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /my tickets/i })).toHaveTextContent("7");
    });
  });

  it("opens the account menu with theme toggle and sign out", async () => {
    mockSession(Role.admin);
    const user = userEvent.setup();
    renderWithProviders(<TabletIconRail />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    expect(
      await screen.findByRole("menuitem", { name: /dark mode/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
  });

  it("opens the notification popover from the rail bell", async () => {
    mockSession(Role.agent);
    const user = userEvent.setup();
    renderWithProviders(<TabletIconRail />);
    await user.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/you're all caught up/i)).toBeInTheDocument();
  });
});
