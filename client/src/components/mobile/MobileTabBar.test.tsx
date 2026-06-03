import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@/lib/auth-client";
import { cleanup, renderWithProviders, screen, waitFor } from "../../test/utils";
import MobileTabBar from "./MobileTabBar";

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
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "u1", name: "Agent" } },
    isPending: false,
  } as unknown as ReturnType<typeof useSession>);
  vi.mocked(axios.get).mockResolvedValue({ data: { count: 0 } });
});

describe("MobileTabBar", () => {
  it("renders the four agent tabs and no admin destinations", () => {
    renderWithProviders(<MobileTabBar />);
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tickets/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /mine/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /stats/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /agents|workflow|activity/i })).toBeNull();
  });

  it("marks the active tab with aria-current", () => {
    renderWithProviders(<MobileTabBar />, { initialEntries: ["/tickets"] });
    expect(screen.getByRole("link", { name: /tickets/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /home/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows the open-count badge on the Mine tab", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { count: 3 } });
    renderWithProviders(<MobileTabBar />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /mine/i })).toHaveTextContent("3");
    });
  });
});
