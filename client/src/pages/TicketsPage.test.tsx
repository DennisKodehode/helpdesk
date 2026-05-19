import {
  type PaginatedTickets,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import TicketsPage from "./TicketsPage";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), isAxiosError: vi.fn() },
}));

const mockPage: PaginatedTickets = {
  data: [
    {
      id: 1,
      fromName: "Alice",
      fromEmail: "alice@example.com",
      subject: "Test ticket",
      status: TicketStatus.open,
      category: null,
      priority: TicketPriority.normal,
      assignedToId: null,
      assigneeType: "none",
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: mockPage });
});

afterEach(cleanup);

describe("TicketsPage", () => {
  it("fetches with default sort params on initial render", async () => {
    renderWithProviders(<TicketsPage />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/tickets", {
        params: { sortBy: "createdAt", sortOrder: "desc", page: 1, pageSize: 10 },
      });
    });
  });

  it("initializes status filter from URL", async () => {
    renderWithProviders(<TicketsPage />, {
      initialEntries: [`/tickets?status=${TicketStatus.open}`],
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
        params: expect.objectContaining({
          status: TicketStatus.open,
          page: 1,
          pageSize: 10,
        }),
      });
    });
  });

  it("renders ticket data after loading", async () => {
    renderWithProviders(<TicketsPage />);
    // Subject text appears in both desktop table and mobile card list.
    const matches = await screen.findAllByText("Test ticket");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows skeleton rows while loading", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<TicketsPage />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows an error message when the fetch fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("Network error"));
    renderWithProviders(<TicketsPage />);
    expect(await screen.findByText("Failed to load tickets")).toBeInTheDocument();
  });

  it("refetches with new sort params when Subject header is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TicketsPage />);

    await screen.findAllByText("Test ticket");

    await user.click(screen.getByRole("columnheader", { name: /subject/i }));

    await waitFor(() => {
      expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
        params: { sortBy: "subject", sortOrder: "asc", page: 1, pageSize: 10 },
      });
    });
  });

  it("refetches with status filter when status dropdown changes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TicketsPage />);

    await screen.findAllByText("Test ticket");

    await user.click(screen.getByRole("combobox", { name: /status/i }));
    await user.click(await screen.findByRole("option", { name: /^open$/i }));

    expect(screen.getByRole("combobox", { name: /status/i })).toHaveTextContent("Open");

    await waitFor(() => {
      expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
        params: expect.objectContaining({
          status: TicketStatus.open,
          page: 1,
          pageSize: 10,
        }),
      });
    });
  });

  it("refetches with debounced search term after typing", async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<TicketsPage />);

    await screen.findAllByText("Test ticket");

    await user.type(screen.getByRole("textbox", { name: /search/i }), "Alice");

    await waitFor(
      () => {
        expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
          params: expect.objectContaining({ search: "Alice", page: 1, pageSize: 10 }),
        });
      },
      { timeout: 1000 },
    );
  });

  it("refetches with category filter when category dropdown changes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TicketsPage />);

    await screen.findAllByText("Test ticket");

    await user.click(screen.getByRole("combobox", { name: /category/i }));
    await user.click(await screen.findByRole("option", { name: /technical/i }));

    expect(screen.getByRole("combobox", { name: /category/i })).toHaveTextContent(
      "Technical",
    );

    await waitFor(() => {
      expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
        params: expect.objectContaining({
          category: TicketCategory.technical_question,
          page: 1,
          pageSize: 10,
        }),
      });
    });
  });

  it("navigates to next page when Next is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(axios.get).mockResolvedValue({
      data: { ...mockPage, total: 25, page: 1 },
    });
    renderWithProviders(<TicketsPage />);
    await screen.findAllByText("Test ticket");

    await user.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() => {
      expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
        params: expect.objectContaining({ page: 2, pageSize: 10 }),
      });
    });
  });
});
