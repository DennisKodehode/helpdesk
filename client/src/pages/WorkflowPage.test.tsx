import {
  AutoAssignMode,
  type SlaHealthResponse,
  type SlaPolicy,
  type StatsResponse,
  TicketPriority,
  type WorkflowSettings,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import WorkflowPage from "./WorkflowPage";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const SETTINGS: WorkflowSettings = {
  autoAssignOn: false,
  autoAssignMode: AutoAssignMode.round_robin,
  autoResolveOn: true,
  autoResolveThreshold: 85,
  requireCategory: true,
  requireAssignee: false,
  autoCloseOn: true,
  autoCloseDays: 7,
  reopenOnReply: true,
  lockClosed: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const POLICIES: SlaPolicy[] = [
  {
    priority: TicketPriority.urgent,
    firstResponseMinutes: 60,
    resolutionMinutes: 240,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    priority: TicketPriority.high,
    firstResponseMinutes: 240,
    resolutionMinutes: 1440,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    priority: TicketPriority.normal,
    firstResponseMinutes: 480,
    resolutionMinutes: 4320,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    priority: TicketPriority.low,
    firstResponseMinutes: 1440,
    resolutionMinutes: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const STATS: StatsResponse = {
  totalTickets: 30,
  openTickets: 8,
  unassignedTickets: 3,
  resolvedTickets: 5,
  closedTickets: 12,
  resolvedByAI: 4,
  percentResolvedByAILast30d: 40,
  avgResolutionMinutes: 120,
  triagingTickets: 5,
  resolvedLast7d: 6,
};

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

function mockGet(url: string) {
  if (url === "/api/workflow-settings") return Promise.resolve({ data: SETTINGS });
  if (url === "/api/sla-policies") return Promise.resolve({ data: POLICIES });
  if (url === "/api/stats") return Promise.resolve({ data: STATS });
  if (url === "/api/stats/sla-health") return Promise.resolve({ data: HEALTH });
  return Promise.reject(new Error(`unexpected GET ${url}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockImplementation((url: string) => mockGet(url) as never);
  vi.mocked(axios.patch).mockResolvedValue({ data: SETTINGS } as never);
});

afterEach(cleanup);

describe("WorkflowPage", () => {
  it("renders the pipeline and lifecycle rules after load", async () => {
    renderWithProviders(<WorkflowPage />);
    expect(await screen.findByText("Auto-assign new tickets")).toBeInTheDocument();
    // Pipeline stage nodes + a data-driven connector label from the rule state.
    expect(screen.getByText("Triaging")).toBeInTheDocument();
    expect(screen.getByText(/AI ≥ 85% resolves/)).toBeInTheDocument();
    // requireCategory is on → the gate footnote pill shows.
    expect(screen.getByText(/Resolve needs category/i)).toBeInTheDocument();
  });

  it("marks lifecycle dirty when a switch toggles and saves via PATCH", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkflowPage />);
    const toggle = await screen.findByRole("switch", { name: "Auto-assign new tickets" });

    await user.click(toggle);

    expect(await screen.findByText(/Lifecycle has unsaved changes/i)).toBeInTheDocument();
    const saveBtn = screen.getByRole("button", { name: /Save changes/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith(
        "/api/workflow-settings",
        expect.objectContaining({ autoAssignOn: true }),
      );
    });
  });

  it("preserves lifecycle edits when switching tabs", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkflowPage />);
    const toggle = await screen.findByRole("switch", { name: "Auto-assign new tickets" });
    await user.click(toggle);
    expect(await screen.findByText(/Lifecycle has unsaved changes/i)).toBeInTheDocument();

    // Switch to SLA targets and back — the edit (and dirty state) must survive.
    await user.click(screen.getByRole("tab", { name: /SLA targets/i }));
    expect(await screen.findByText(/Targets by priority/i)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Lifecycle rules/i }));

    expect(await screen.findByText(/Lifecycle has unsaved changes/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("switch", { name: "Auto-assign new tickets" }),
    ).toHaveAttribute("aria-checked", "true");
  });
});
