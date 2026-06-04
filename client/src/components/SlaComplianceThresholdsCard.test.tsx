import type { SlaComplianceResponse } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import SlaComplianceThresholdsCard from "./SlaComplianceThresholdsCard";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

function mockCompliance(
  data: SlaComplianceResponse = { firstResponse: 94, resolution: 88 },
) {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/stats/sla-compliance") return Promise.resolve({ data }) as never;
    return Promise.reject(new Error(`unexpected GET ${url}`)) as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCompliance();
});

afterEach(cleanup);

describe("SlaComplianceThresholdsCard", () => {
  it("renders both thresholds as steppers with a % suffix", () => {
    renderWithProviders(
      <SlaComplianceThresholdsCard greenMin={90} yellowMin={60} onChange={vi.fn()} />,
    );
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("calls onChange when the green stepper is incremented", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <SlaComplianceThresholdsCard greenMin={90} yellowMin={60} onChange={onChange} />,
    );
    await user.click(screen.getByRole("button", { name: /increase healthy/i }));
    expect(onChange).toHaveBeenCalledWith("slaGreenMin", 91);
  });

  it("clamps the steppers against each other so green stays above amber", () => {
    // green one above amber: green "−" and amber "＋" are both at their bound.
    renderWithProviders(
      <SlaComplianceThresholdsCard greenMin={61} yellowMin={60} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /decrease healthy/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /increase warning/i })).toBeDisabled();
  });

  it("derives the legend from the live values", () => {
    renderWithProviders(
      <SlaComplianceThresholdsCard greenMin={90} yellowMin={60} onChange={vi.fn()} />,
    );
    expect(screen.getByText(/Green ≥ 90/)).toBeInTheDocument();
    expect(screen.getByText(/Amber 60/)).toBeInTheDocument();
    expect(screen.getByText(/Red < 60/)).toBeInTheDocument();
  });

  it("shows the ordering message when green is not above amber", () => {
    renderWithProviders(
      <SlaComplianceThresholdsCard greenMin={50} yellowMin={60} onChange={vi.fn()} />,
    );
    expect(screen.getByText(/Green must sit above amber/i)).toBeInTheDocument();
    expect(screen.getByText(/Amber —/)).toBeInTheDocument();
  });

  it("colours the preview rings from the working-draft thresholds", async () => {
    // green ≥ 80, amber ≥ 55: first response 85 → green; resolution 50 → red.
    mockCompliance({ firstResponse: 85, resolution: 50 });
    const { container } = renderWithProviders(
      <SlaComplianceThresholdsCard greenMin={80} yellowMin={55} onChange={vi.fn()} />,
    );
    // The coloured arc only renders once the compliance percents have loaded.
    await waitFor(() =>
      expect(container.querySelectorAll('circle[stroke-linecap="round"]')).toHaveLength(
        2,
      ),
    );

    const arcs = container.querySelectorAll('circle[stroke-linecap="round"]');
    expect(arcs[0].getAttribute("class")).toContain("stroke-eme-dot");
    expect(arcs[1].getAttribute("class")).toContain("stroke-ros-dot");
  });
});
