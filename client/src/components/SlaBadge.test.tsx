import { TicketPriority, TicketStatus } from "@helpdesk/core";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import { SlaBadge } from "./SlaBadge";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const HOUR = 60 * 60 * 1000;

const DEFAULT_POLICIES = [
  {
    priority: TicketPriority.urgent,
    firstResponseMinutes: 60,
    resolutionMinutes: 240,
    updatedAt: new Date().toISOString(),
  },
  {
    priority: TicketPriority.high,
    firstResponseMinutes: 240,
    resolutionMinutes: 1440,
    updatedAt: new Date().toISOString(),
  },
  {
    priority: TicketPriority.normal,
    firstResponseMinutes: 480,
    resolutionMinutes: 4320,
    updatedAt: new Date().toISOString(),
  },
  {
    priority: TicketPriority.low,
    firstResponseMinutes: 1440,
    resolutionMinutes: null,
    updatedAt: new Date().toISOString(),
  },
];

beforeEach(() => {
  vi.mocked(axios.get).mockResolvedValue({ data: DEFAULT_POLICIES });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SlaBadge", () => {
  it("renders 'Breached' when the first-response window has elapsed", async () => {
    const ticket = {
      createdAt: new Date(Date.now() - 5 * HOUR).toISOString(),
      firstAgentReplyAt: null,
      resolvedAt: null,
      priority: TicketPriority.urgent,
      status: TicketStatus.open,
    };
    renderWithProviders(<SlaBadge ticket={ticket} />);
    expect(await screen.findByText("Breached")).toBeInTheDocument();
  });

  it("renders 'At risk' when between 75% and 100% of the window has elapsed", async () => {
    // urgent first-response = 60min. Aging 50min → ~83% elapsed → at_risk.
    const ticket = {
      createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      firstAgentReplyAt: null,
      resolvedAt: null,
      priority: TicketPriority.urgent,
      status: TicketStatus.open,
    };
    renderWithProviders(<SlaBadge ticket={ticket} />);
    expect(await screen.findByText("At risk")).toBeInTheDocument();
  });

  it("renders nothing when the ticket is healthy (<75% elapsed)", async () => {
    const ticket = {
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      firstAgentReplyAt: null,
      resolvedAt: null,
      priority: TicketPriority.urgent,
      status: TicketStatus.open,
    };
    const { container } = renderWithProviders(<SlaBadge ticket={ticket} />);
    // Wait one tick for the policies query to resolve so we know "ok" was the
    // computed state and not just the pre-fetch loading state.
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing once the ticket is resolved", async () => {
    const ticket = {
      createdAt: new Date(Date.now() - 100 * HOUR).toISOString(),
      firstAgentReplyAt: null,
      resolvedAt: new Date(Date.now() - 1 * HOUR).toISOString(),
      priority: TicketPriority.urgent,
      status: TicketStatus.resolved,
    };
    const { container } = renderWithProviders(<SlaBadge ticket={ticket} />);
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a low-priority ticket past resolution window when policy has null resolutionMinutes", async () => {
    // low: firstResponse=1440min (24h), resolution=null. Aging 100h with no
    // reply still breaches first-response; let's instead simulate a reply
    // already happened so only the resolution metric could fire — and it
    // should NOT fire because policy.resolutionMinutes is null.
    const ticket = {
      createdAt: new Date(Date.now() - 100 * HOUR).toISOString(),
      firstAgentReplyAt: new Date(Date.now() - 99 * HOUR).toISOString(),
      resolvedAt: null,
      priority: TicketPriority.low,
      status: TicketStatus.open,
    };
    const { container } = renderWithProviders(<SlaBadge ticket={ticket} />);
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("includes a tooltip describing the metric and time-to/from-due", async () => {
    const ticket = {
      createdAt: new Date(Date.now() - 3 * HOUR).toISOString(),
      firstAgentReplyAt: null,
      resolvedAt: null,
      priority: TicketPriority.urgent,
      status: TicketStatus.open,
    };
    renderWithProviders(<SlaBadge ticket={ticket} />);
    const badge = await screen.findByText("Breached");
    expect(badge).toHaveAttribute("title");
    expect(badge.getAttribute("title")).toMatch(/First-response SLA/);
    expect(badge.getAttribute("title")).toMatch(/overdue/);
  });
});
