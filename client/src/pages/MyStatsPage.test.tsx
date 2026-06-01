import type { PersonalStatsResponse } from "@helpdesk/core";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import MyStatsPage from "./MyStatsPage";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const statsResponse: PersonalStatsResponse = {
  openOnMyPlate: 4,
  resolvedLifetime: 123,
  resolved30d: 17,
  avgResolutionMinutes: 90, // -> "1h 30m"
  avgFirstResponseMinutes: null, // -> "—"
  repliesLifetime: 42,
  replies30d: 9,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: statsResponse });
});

afterEach(cleanup);

describe("MyStatsPage", () => {
  it("fetches /api/stats/me on mount", async () => {
    renderWithProviders(<MyStatsPage />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/stats/me",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("renders the page header", () => {
    renderWithProviders(<MyStatsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /my stats/i }),
    ).toBeInTheDocument();
  });

  it("renders the hero open-on-my-plate value and links to my-tickets", async () => {
    renderWithProviders(<MyStatsPage />);
    const heroLink = await screen.findByRole("link", { name: /open on your plate.*4/i });
    expect(heroLink).toHaveAttribute("href", "/my-tickets");
    expect(heroLink).toHaveTextContent("4");
  });

  it("renders the resolved counters", async () => {
    renderWithProviders(<MyStatsPage />);
    expect(await screen.findByText("Resolved · 30 days")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
    expect(screen.getByText("Resolved · lifetime")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
  });

  it("renders the speed cards with formatted durations, including '—' for null", async () => {
    renderWithProviders(<MyStatsPage />);
    expect(await screen.findByText("Avg. resolution")).toBeInTheDocument();
    expect(screen.getByText("1h 30m")).toBeInTheDocument();
    expect(screen.getByText("Avg. first reply")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the reply counters", async () => {
    renderWithProviders(<MyStatsPage />);
    expect(await screen.findByText("Replies · 30 days")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Replies · lifetime")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders the attribution note", async () => {
    renderWithProviders(<MyStatsPage />);
    expect(
      await screen.findByText(
        /throughput and resolution time credit the agent currently assigned/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows loading skeletons before the request resolves", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MyStatsPage />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows an error message when the fetch fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("boom"));
    renderWithProviders(<MyStatsPage />);
    expect(await screen.findByText("Failed to load your stats")).toBeInTheDocument();
  });
});
