import type { SlaHealthResponse, StatsResponse } from "@helpdesk/core";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../../test/utils";
import StatCards from "./StatCards";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const STATS: StatsResponse = {
  totalTickets: 100,
  openTickets: 12,
  unassignedTickets: 4,
  resolvedTickets: 60,
  closedTickets: 24,
  resolvedByAI: 40,
  percentResolvedByAILast30d: 55,
  avgResolutionMinutes: 90,
  triagingTickets: 7,
  resolvedLast7d: 18,
};

const SLA: SlaHealthResponse = {
  total: 16,
  breached: 3,
  atRisk: 2,
  ok: 11,
  byMetric: {
    firstResponse: { breached: 2, atRisk: 1 },
    resolution: { breached: 1, atRisk: 1 },
  },
};

function mockBoth() {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/stats") return Promise.resolve({ data: STATS });
    if (url === "/api/stats/sla-health") return Promise.resolve({ data: SLA });
    return Promise.resolve({ data: {} });
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StatCards", () => {
  it("renders a loading state while pending", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<StatCards />);
    expect(screen.getByRole("status", { name: /loading stats/i })).toBeInTheDocument();
  });

  it("renders the four cards with values from both endpoints", async () => {
    mockBoth();
    renderWithProviders(<StatCards />);
    expect(await screen.findByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Needs triage")).toBeInTheDocument();
    expect(screen.getByText("SLA breached")).toBeInTheDocument();
    expect(screen.getByText("Resolved · 7d")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument(); // open
    expect(screen.getByText("7")).toBeInTheDocument(); // triaging
    expect(screen.getByText("3")).toBeInTheDocument(); // breached (from sla-health)
    expect(screen.getByText("18")).toBeInTheDocument(); // resolved 7d
  });

  it("links each card to a filtered queue", async () => {
    mockBoth();
    renderWithProviders(<StatCards />);
    const triage = await screen.findByRole("link", { name: /needs triage: 7/i });
    expect(triage).toHaveAttribute("href", "/tickets?status=triaging");
    expect(screen.getByRole("link", { name: /sla breached: 3/i })).toHaveAttribute(
      "href",
      "/tickets?breachedOnly=true",
    );
    // Resolved · 7d links to the matching `recently_resolved` view (resolved or
    // closed within 7 days) — not status=resolved, which would undercount.
    expect(screen.getByRole("link", { name: /resolved · 7d: 18/i })).toHaveAttribute(
      "href",
      "/tickets?view=recently_resolved",
    );
  });
});
