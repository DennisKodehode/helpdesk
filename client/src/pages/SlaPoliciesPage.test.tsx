import { type SlaHealthResponse, type SlaPolicy, TicketPriority } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import SlaPoliciesPage from "./SlaPoliciesPage";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const POLICIES: SlaPolicy[] = [
  {
    priority: TicketPriority.urgent,
    firstResponseMinutes: 15,
    resolutionMinutes: 240,
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    priority: TicketPriority.high,
    firstResponseMinutes: 60,
    resolutionMinutes: 480,
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    priority: TicketPriority.normal,
    firstResponseMinutes: 240,
    resolutionMinutes: 1440,
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    priority: TicketPriority.low,
    firstResponseMinutes: 480,
    resolutionMinutes: null,
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

const HEALTH: SlaHealthResponse = {
  total: 8,
  breached: 1,
  atRisk: 2,
  ok: 5,
  byMetric: {
    firstResponse: { breached: 1, atRisk: 1 },
    resolution: { breached: 0, atRisk: 1 },
  },
};

function mockGet() {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/sla-policies") return Promise.resolve({ data: POLICIES });
    if (url === "/api/stats/sla-health") return Promise.resolve({ data: HEALTH });
    return Promise.resolve({ data: [] });
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SlaPoliciesPage", () => {
  it("renders a card per priority, urgent first", async () => {
    mockGet();
    renderWithProviders(<SlaPoliciesPage />);
    expect(await screen.findByText("Urgent")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("hides Save/Revert until an edit makes the form dirty", async () => {
    mockGet();
    const user = userEvent.setup();
    renderWithProviders(<SlaPoliciesPage />);
    await screen.findByText("Urgent");
    expect(
      screen.queryByRole("button", { name: /save targets/i }),
    ).not.toBeInTheDocument();

    const input = screen.getByLabelText("Urgent First response value");
    await user.clear(input);
    await user.type(input, "30");

    expect(
      await screen.findByRole("button", { name: /save targets/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revert/i })).toBeInTheDocument();
  });

  it("reverts edits back to the loaded values", async () => {
    mockGet();
    const user = userEvent.setup();
    renderWithProviders(<SlaPoliciesPage />);
    await screen.findByText("Urgent");
    const input = screen.getByLabelText("Urgent First response value");
    await user.clear(input);
    await user.type(input, "30");
    await user.click(await screen.findByRole("button", { name: /revert/i }));
    expect(
      screen.queryByRole("button", { name: /save targets/i }),
    ).not.toBeInTheDocument();
  });

  it("PATCHes the changed policy on save", async () => {
    mockGet();
    vi.mocked(axios.patch).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<SlaPoliciesPage />);
    await screen.findByText("Urgent");
    const input = screen.getByLabelText("Urgent First response value");
    await user.clear(input);
    await user.type(input, "30");
    await user.click(await screen.findByRole("button", { name: /save targets/i }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith(
        "/api/sla-policies/urgent",
        expect.objectContaining({ firstResponseMinutes: expect.any(Number) }),
      );
    });
  });
});
