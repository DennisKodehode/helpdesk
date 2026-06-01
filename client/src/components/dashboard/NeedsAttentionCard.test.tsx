import { type NeedsAttentionResponse, SlaMetric, TicketPriority } from "@helpdesk/core";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../../test/utils";
import NeedsAttentionCard from "./NeedsAttentionCard";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const ROWS: NeedsAttentionResponse = [
  {
    id: 7,
    subject: "Urgent: server down",
    priority: TicketPriority.urgent,
    slaState: "breached",
    slaMetric: SlaMetric.first_response,
  },
  {
    id: 8,
    subject: "Billing question",
    priority: TicketPriority.high,
    slaState: "at_risk",
    slaMetric: SlaMetric.resolution,
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NeedsAttentionCard", () => {
  it("renders at-risk/breached rows with subject, id link, and SLA pill", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: ROWS });
    renderWithProviders(<NeedsAttentionCard />);
    expect(await screen.findByText("Urgent: server down")).toBeInTheDocument();
    expect(screen.getByText("Billing question")).toBeInTheDocument();
    expect(screen.getByText("Breached")).toBeInTheDocument();
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /server down/i })).toHaveAttribute(
      "href",
      "/tickets/7",
    );
  });

  it("renders an all-clear empty state", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    renderWithProviders(<NeedsAttentionCard />);
    expect(await screen.findByText(/nothing at risk/i)).toBeInTheDocument();
  });
});
