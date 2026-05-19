import { type PaginatedTickets, TicketPriority, TicketStatus } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor, within } from "../test/utils";
import MyTicketsPage from "./MyTicketsPage";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const emptyPage: PaginatedTickets = { data: [], total: 0, page: 1, pageSize: 10 };

const activePage: PaginatedTickets = {
  data: [
    {
      id: 1,
      fromName: "Alice",
      fromEmail: "alice@example.com",
      subject: "My active ticket",
      status: TicketStatus.open,
      category: null,
      priority: TicketPriority.normal,
      assignedToId: "me-id",
      assigneeType: "human",
      isSuppressed: false,
      firstAgentReplyAt: null,
      resolvedAt: null,
      createdAt: "2024-01-15T00:00:00Z",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
};

const closedPage: PaginatedTickets = {
  data: [
    {
      id: 2,
      fromName: "Bob",
      fromEmail: "bob@example.com",
      subject: "My closed ticket",
      status: TicketStatus.closed,
      category: null,
      priority: TicketPriority.normal,
      assignedToId: "me-id",
      assigneeType: "human",
      isSuppressed: false,
      firstAgentReplyAt: null,
      resolvedAt: null,
      createdAt: "2024-01-10T00:00:00Z",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
};

function setupAxiosByStatus(map: Partial<Record<TicketStatus, PaginatedTickets>>) {
  vi.mocked(axios.get).mockImplementation(
    async (_url: string, config?: { params?: Record<string, unknown> }) => {
      const status = config?.params?.status as TicketStatus | undefined;
      if (status && map[status]) return { data: map[status]! };
      return { data: emptyPage };
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("MyTicketsPage", () => {
  it("renders both sections and fetches open + closed by default", async () => {
    setupAxiosByStatus({
      [TicketStatus.open]: activePage,
      [TicketStatus.closed]: closedPage,
    });

    renderWithProviders(<MyTicketsPage />);

    expect(
      screen.getByRole("heading", { level: 2, name: /active/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /closed/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({
          assignee: "me",
          status: TicketStatus.open,
          page: 1,
          pageSize: 10,
        }),
      });
      expect(axios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({
          assignee: "me",
          status: TicketStatus.closed,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    expect(await screen.findAllByText("My active ticket")).not.toHaveLength(0);
    expect(await screen.findAllByText("My closed ticket")).not.toHaveLength(0);
  });

  it("switches the Active section to Resolved when the Resolved pill is clicked", async () => {
    setupAxiosByStatus({
      [TicketStatus.open]: activePage,
      [TicketStatus.closed]: emptyPage,
    });

    const user = userEvent.setup();
    renderWithProviders(<MyTicketsPage />);

    await screen.findAllByText("My active ticket");

    const activeSection = screen.getByRole("region", { name: /active/i });
    await user.click(within(activeSection).getByRole("button", { name: /resolved/i }));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({
          assignee: "me",
          status: TicketStatus.resolved,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    expect(
      within(activeSection).getByRole("button", { name: /resolved/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("initializes Active filter from the ?active=resolved URL param", async () => {
    setupAxiosByStatus({
      [TicketStatus.resolved]: activePage,
      [TicketStatus.closed]: emptyPage,
    });

    renderWithProviders(<MyTicketsPage />, {
      initialEntries: ["/my-tickets?active=resolved"],
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({
          assignee: "me",
          status: TicketStatus.resolved,
        }),
      });
    });
  });

  it("shows per-scope empty copy when both sections return zero results", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: emptyPage });

    renderWithProviders(<MyTicketsPage />);

    expect(await screen.findAllByText("Nothing on your plate")).not.toHaveLength(0);
    expect(await screen.findAllByText("Nothing closed yet")).not.toHaveLength(0);
  });

  it("shows an error message when a section fails to load", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("boom"));

    renderWithProviders(<MyTicketsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Failed to load tickets").length).toBeGreaterThanOrEqual(
        2,
      );
    });
  });
});
