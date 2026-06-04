import {
  AutoAssignMode,
  type SlaComplianceResponse,
  type WorkflowSettings,
} from "@helpdesk/core";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../../test/utils";
import SlaRingsCard from "./SlaRingsCard";

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
  slaGreenMin: 90,
  slaYellowMin: 60,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// URL-aware GET mock: the card reads both the compliance stats and the workflow
// settings (for the colour thresholds).
function mockGet(
  compliance: SlaComplianceResponse,
  settings: WorkflowSettings = SETTINGS,
) {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/stats/sla-compliance") return Promise.resolve({ data: compliance });
    if (url === "/api/workflow-settings") return Promise.resolve({ data: settings });
    return Promise.reject(new Error(`unexpected GET ${url}`)) as never;
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SlaRingsCard", () => {
  it("renders both rings with their percentages", async () => {
    mockGet({ firstResponse: 94, resolution: 88 });
    renderWithProviders(<SlaRingsCard />);
    expect(await screen.findByText("94")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("First response")).toBeInTheDocument();
    expect(screen.getByText("Resolution")).toBeInTheDocument();
  });

  it("renders an em-dash when a metric has no measurable data", async () => {
    mockGet({ firstResponse: null, resolution: 100 });
    renderWithProviders(<SlaRingsCard />);
    expect(await screen.findByText("—")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders an error alert when the query fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("boom"));
    renderWithProviders(<SlaRingsCard />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed to load sla compliance/i,
    );
  });

  it("colours the ring by the admin-configured thresholds", async () => {
    // With green ≥ 80, a value of 85 is healthy (green) — under the default
    // green ≥ 90 it would have been amber, so this proves the thresholds drive it.
    mockGet(
      { firstResponse: 85, resolution: 50 },
      { ...SETTINGS, slaGreenMin: 80, slaYellowMin: 55 },
    );
    const { container } = renderWithProviders(<SlaRingsCard />);
    await screen.findByText("85");

    const arcs = container.querySelectorAll('circle[stroke-linecap="round"]');
    expect(arcs).toHaveLength(2);
    // 85 ≥ 80 → green; 50 < 55 → red.
    expect(arcs[0].getAttribute("class")).toContain("stroke-eme-dot");
    expect(arcs[1].getAttribute("class")).toContain("stroke-ros-dot");
  });
});
