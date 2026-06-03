import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../../test/utils";
import MobileStats from "./MobileStats";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MobileStats", () => {
  it("renders the personal stats once loaded", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        openOnMyPlate: 4,
        resolvedLifetime: 120,
        resolved30d: 18,
        avgResolutionMinutes: 95,
        avgFirstResponseMinutes: 12,
        repliesLifetime: 540,
        replies30d: 60,
      },
    });
    renderWithProviders(<MobileStats />);
    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText(/open on my plate/i)).toBeInTheDocument();
    // 95 minutes formats as "1h 35m".
    expect(screen.getByText("1h 35m")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("boom"));
    renderWithProviders(<MobileStats />);
    expect(await screen.findByText(/failed to load your stats/i)).toBeInTheDocument();
  });
});
