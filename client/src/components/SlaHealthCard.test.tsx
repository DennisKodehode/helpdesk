import type { SlaHealthResponse } from "@helpdesk/core";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor, within } from "../test/utils";
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
  it("renders a loading skeleton while the query is pending", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<SlaHealthCard />);
    expect(
      screen.getByRole("status", { name: /loading sla health/i }),
    ).toBeInTheDocument();
  });

  it("renders the three counts with labels", async () => {
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
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/12 active tickets/i)).toBeInTheDocument();
  });

  it("wraps the breached column in a link to /tickets?breachedOnly=true", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: makeResponse({ total: 3, breached: 2, atRisk: 0, ok: 1 }),
    });
    renderWithProviders(<SlaHealthCard />);
    const link = await screen.findByRole("link", { name: /breached: 2/i });
    expect(link).toHaveAttribute("href", "/tickets?breachedOnly=true");
  });

  it("exposes a byMetric tooltip on the breached column", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: makeResponse({
        total: 3,
        breached: 2,
        byMetric: {
          firstResponse: { breached: 1, atRisk: 0 },
          resolution: { breached: 1, atRisk: 0 },
        },
        ok: 1,
      }),
    });
    renderWithProviders(<SlaHealthCard />);
    const link = await screen.findByRole("link", { name: /breached: 2/i });
    // The tooltip lives on the inner StatColumn div via the `title` attribute.
    const titled = within(link).getByTitle(/First-response: 1/);
    expect(titled).toBeInTheDocument();
    expect(titled.getAttribute("title")).toMatch(/Resolution: 1/);
  });

  it("renders an empty state when there are no active tickets", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: makeResponse({ total: 0, ok: 0 }) });
    renderWithProviders(<SlaHealthCard />);
    expect(await screen.findByText(/no active tickets/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing to track right now/i)).toBeInTheDocument();
    expect(screen.queryByText("Breached")).not.toBeInTheDocument();
  });

  it("renders an error alert when the query fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("boom"));
    renderWithProviders(<SlaHealthCard />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/boom/));
  });
});
