import type { SlaComplianceResponse } from "@helpdesk/core";
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SlaRingsCard", () => {
  it("renders both rings with their percentages", async () => {
    const data: SlaComplianceResponse = { firstResponse: 94, resolution: 88 };
    vi.mocked(axios.get).mockResolvedValue({ data });
    renderWithProviders(<SlaRingsCard />);
    expect(await screen.findByText("94")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("First response")).toBeInTheDocument();
    expect(screen.getByText("Resolution")).toBeInTheDocument();
  });

  it("renders an em-dash when a metric has no measurable data", async () => {
    const data: SlaComplianceResponse = { firstResponse: null, resolution: 100 };
    vi.mocked(axios.get).mockResolvedValue({ data });
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
});
