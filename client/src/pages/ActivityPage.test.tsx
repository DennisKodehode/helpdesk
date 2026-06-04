import {
  type AuditEventRow,
  AuditEventType,
  type HealthSignalsResponse,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor, within } from "../test/utils";
import ActivityPage from "./ActivityPage";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const ROW: AuditEventRow = {
  id: "e1",
  type: AuditEventType.status_changed,
  ticketId: 42,
  ticketSubject: "Login broken",
  actorName: "Alice Agent",
  data: {},
  createdAt: new Date().toISOString(),
};

const HEALTH_SIGNALS: HealthSignalsResponse = {
  windowDays: 7,
  signals: [
    {
      id: "ai-escalation",
      value: 38,
      numerator: 62,
      denominator: 163,
      state: "alert",
      delta: 7,
      spark: [22, 24, 21, 26, 29, 31, 30, 34, 33, 38],
      lowSample: false,
      avgHandoffs: null,
    },
  ],
};

function mockApi({
  events = [] as AuditEventRow[],
  total = 0,
  rejectAudit = false,
} = {}) {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/users/roster") return Promise.resolve({ data: [] });
    if (url === "/api/stats/health-signals")
      return Promise.resolve({ data: HEALTH_SIGNALS });
    if (url === "/api/audit-events") {
      return rejectAudit
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ data: { data: events, total, page: 1, pageSize: 25 } });
    }
    return Promise.resolve({ data: {} });
  });
}

function auditCalls() {
  return vi.mocked(axios.get).mock.calls.filter((c) => c[0] === "/api/audit-events");
}

beforeEach(() => mockApi());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ActivityPage", () => {
  it("sends the URL filters as query params", async () => {
    mockApi({ events: [ROW], total: 1 });
    renderWithProviders(<ActivityPage />, {
      initialEntries: [
        "/activity?type=status_changed&actorId=ai&from=2026-05-01&to=2026-05-31&page=2",
      ],
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/audit-events",
        expect.objectContaining({
          params: expect.objectContaining({
            type: "status_changed",
            actorId: "ai",
            from: "2026-05-01",
            to: "2026-05-31",
            page: 2,
          }),
        }),
      );
    });
  });

  it("renders the loaded rows", async () => {
    mockApi({ events: [ROW], total: 1 });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity"] });
    expect(await screen.findByText(/Alice Agent changed status/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#0042" })).toBeInTheDocument();
  });

  it("renders the health-signals watchlist and a row drills into the activity filter", async () => {
    mockApi({ events: [ROW], total: 1 });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity"] });

    // The watchlist signal renders above the log.
    await screen.findByText("AI escalation rate");

    // Clicking the row sets ?type=ai_escalated → the log refetches with that type.
    await userEvent.click(screen.getByRole("button", { name: /AI escalation rate/i }));
    await waitFor(() => {
      expect(
        auditCalls().some(
          (c) => (c[1] as { params: { type?: string } }).params.type === "ai_escalated",
        ),
      ).toBe(true);
    });
  });

  it("renders an empty state", async () => {
    mockApi({ events: [], total: 0 });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity"] });
    expect(
      await screen.findByText(/no activity matches these filters/i),
    ).toBeInTheDocument();
  });

  it("renders an error state", async () => {
    mockApi({ rejectAudit: true });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity"] });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed to load activity/i,
    );
  });

  it("paginates: Next refetches with the incremented page", async () => {
    mockApi({ events: [ROW], total: 60 });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity?page=2"] });
    await screen.findByText(/Alice Agent changed status/i);

    await userEvent.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() => {
      expect(
        auditCalls().some(
          (c) => (c[1] as { params: { page: number } }).params.page === 3,
        ),
      ).toBe(true);
    });
  });

  it("changing a filter refetches and resets to page 1", async () => {
    mockApi({ events: [ROW], total: 1 });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity?page=3"] });
    await screen.findByText(/Alice Agent changed status/i);

    // Pick a date via the calendar popover. The default month follows the real
    // clock, so assert the shape of `from` (a valid ISO date) rather than an
    // exact value — the behavior under test is "filter change resets to page 1".
    await userEvent.click(screen.getByRole("button", { name: "From date" }));
    const grid = await screen.findByRole("grid");
    const day15 = within(grid)
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "15");
    if (!day15) throw new Error("day 15 not found in calendar");
    await userEvent.click(day15);

    await waitFor(() => {
      expect(
        auditCalls().some((c) => {
          const params = (c[1] as { params: { from?: string; page: number } }).params;
          return /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "") && params.page === 1;
        }),
      ).toBe(true);
    });
  });
});
