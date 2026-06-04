import {
  AuditEventType,
  type HealthSignal,
  type HealthSignalsResponse,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import HealthSignalsWatchlist from "./HealthSignalsWatchlist";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const SPARK = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function signal(over: Partial<HealthSignal> & Pick<HealthSignal, "id">): HealthSignal {
  return {
    value: 10,
    numerator: 1,
    denominator: 100,
    state: "ok",
    delta: 0,
    spark: SPARK,
    lowSample: false,
    avgHandoffs: null,
    ...over,
  };
}

function mockSignals(signals: HealthSignal[]) {
  const body: HealthSignalsResponse = { signals, windowDays: 7 };
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/stats/health-signals")
      return Promise.resolve({ data: body }) as never;
    return Promise.reject(new Error(`unexpected GET ${url}`)) as never;
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("HealthSignalsWatchlist", () => {
  it("renders a signal's label, value, state tag and caption", async () => {
    mockSignals([
      signal({
        id: "ai-escalation",
        value: 38,
        numerator: 62,
        denominator: 163,
        state: "alert",
        delta: 7,
      }),
    ]);
    renderWithProviders(<HealthSignalsWatchlist currentType="" onDrill={vi.fn()} />);

    expect(await screen.findByText("AI escalation rate")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("62 of 163 AI-handled tickets")).toBeInTheDocument();
    expect(screen.getByText("7 pts")).toBeInTheDocument();
    // Watch/alert → the probable-cause line.
    expect(screen.getByText(/likely knowledge-base gaps/i)).toBeInTheDocument();
  });

  it("shows the healthy read for a healthy signal, not the concern line", async () => {
    mockSignals([signal({ id: "priority", value: 11, state: "ok" })]);
    renderWithProviders(<HealthSignalsWatchlist currentType="" onDrill={vi.fn()} />);

    expect(
      await screen.findByText(/intake grading is mostly landing right/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/intake priority often missed/i)).not.toBeInTheDocument();
  });

  it("sorts rows by severity (alert → watch → ok)", async () => {
    mockSignals([
      signal({ id: "priority", state: "ok" }),
      signal({ id: "ai-escalation", state: "alert" }),
      signal({ id: "reassignment", state: "watch" }),
    ]);
    renderWithProviders(<HealthSignalsWatchlist currentType="" onDrill={vi.fn()} />);
    await screen.findByText("AI escalation rate");

    const labels = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? "");
    expect(labels[0]).toMatch(/AI escalation rate/);
    expect(labels[1]).toMatch(/Reassignment churn/);
    expect(labels[2]).toMatch(/Priority re-triage/);
  });

  it("filters the activity log to the signal's event type on click", async () => {
    const onDrill = vi.fn();
    mockSignals([signal({ id: "ai-escalation", state: "alert" })]);
    renderWithProviders(<HealthSignalsWatchlist currentType="" onDrill={onDrill} />);

    await userEvent.click(
      await screen.findByRole("button", { name: /AI escalation rate/i }),
    );
    expect(onDrill).toHaveBeenCalledWith(AuditEventType.ai_escalated);
  });

  it("suppresses alarm copy for a low-sample signal", async () => {
    mockSignals([
      signal({
        id: "reopened",
        state: "ok",
        lowSample: true,
        denominator: 3,
        numerator: 0,
      }),
    ]);
    renderWithProviders(<HealthSignalsWatchlist currentType="" onDrill={vi.fn()} />);
    expect(await screen.findByText(/not enough to read yet/i)).toBeInTheDocument();
  });

  it("shows an error alert when the query fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("boom"));
    renderWithProviders(<HealthSignalsWatchlist currentType="" onDrill={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed to load health signals/i,
    );
  });

  it("renders a loading state then the rows", async () => {
    mockSignals([signal({ id: "ai-escalation", state: "alert" })]);
    renderWithProviders(<HealthSignalsWatchlist currentType="" onDrill={vi.fn()} />);
    expect(
      screen.getByRole("status", { name: /loading health signals/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("AI escalation rate")).toBeInTheDocument(),
    );
  });
});
