import type { SlaHealthResponse } from "@helpdesk/core";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import SlaHealthCard from "./SlaHealthCard";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

function makeResponse(overrides: Partial<SlaHealthResponse> = {}): SlaHealthResponse {
  return {
    total: 10,
    breached: 0,
    atRisk: 0,
    ok: 10,
    byMetric: {
      firstResponse: { breached: 0, atRisk: 0 },
      resolution: { breached: 0, atRisk: 0 },
    },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SlaHealthCard", () => {
  it("renders a loading skeleton while pending", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<SlaHealthCard />);
    expect(
      screen.getByRole("status", { name: /loading sla health/i }),
    ).toBeInTheDocument();
  });

  it("renders the three counts, the active total, and the by-metric line", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: makeResponse({
        total: 12,
        breached: 3,
        atRisk: 4,
        ok: 5,
        byMetric: {
          firstResponse: { breached: 2, atRisk: 3 },
          resolution: { breached: 1, atRisk: 1 },
        },
      }),
    });
    renderWithProviders(<SlaHealthCard />);
    expect(await screen.findByText("Breached")).toBeInTheDocument();
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.getByText("On track")).toBeInTheDocument();
    expect(screen.getByText("12 active tickets")).toBeInTheDocument();
    expect(screen.getByText("First response")).toBeInTheDocument();
    expect(screen.getByText("2 breached · 3 at risk")).toBeInTheDocument();
    expect(screen.getByText("1 breached · 1 at risk")).toBeInTheDocument();
  });

  it("renders an error state when the query fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("boom"));
    renderWithProviders(<SlaHealthCard />);
    expect(await screen.findByText(/failed to load sla health/i)).toBeInTheDocument();
  });
});
