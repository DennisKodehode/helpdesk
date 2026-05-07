import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import TicketsPage from "./TicketsPage";
import { TicketStatus, TicketCategory, type Ticket } from "@helpdesk/core";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), isAxiosError: vi.fn() },
}));

const mockTickets: Ticket[] = [
  {
    id: 1,
    fromName: "Alice",
    fromEmail: "alice@example.com",
    subject: "Test ticket",
    status: TicketStatus.open,
    category: null,
    assignedToId: null,
    createdAt: "2024-01-15T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: mockTickets });
});

afterEach(cleanup);

describe("TicketsPage", () => {
  it("fetches with default sort params on initial render", async () => {
    renderWithProviders(<TicketsPage />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/tickets", {
        params: { sortBy: "createdAt", sortOrder: "desc" },
      });
    });
  });

  it("renders ticket data after loading", async () => {
    renderWithProviders(<TicketsPage />);
    expect(await screen.findByText("Test ticket")).toBeInTheDocument();
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

    await screen.findByText("Test ticket");

    await user.click(screen.getByRole("columnheader", { name: /subject/i }));

    await waitFor(() => {
      expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
        params: { sortBy: "subject", sortOrder: "asc" },
      });
    });
  });

  it("refetches with status filter when status dropdown changes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TicketsPage />);

    await screen.findByText("Test ticket");

    await user.click(screen.getByRole("combobox", { name: /status/i }));
    await user.click(await screen.findByRole("option", { name: /^open$/i }));

    expect(screen.getByRole("combobox", { name: /status/i })).toHaveTextContent("Open");

    await waitFor(() => {
      expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
        params: expect.objectContaining({ status: TicketStatus.open }),
      });
    });
  });

  it("refetches with debounced search term after typing", async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<TicketsPage />);

    await screen.findByText("Test ticket");

    await user.type(screen.getByRole("textbox", { name: /search/i }), "Alice");

    await waitFor(() => {
      expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
        params: expect.objectContaining({ search: "Alice" }),
      });
    }, { timeout: 1000 });
  });

  it("refetches with category filter when category dropdown changes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TicketsPage />);

    await screen.findByText("Test ticket");

    await user.click(screen.getByRole("combobox", { name: /category/i }));
    await user.click(await screen.findByRole("option", { name: /technical/i }));

    expect(screen.getByRole("combobox", { name: /category/i })).toHaveTextContent("Technical");

    await waitFor(() => {
      expect(axios.get).toHaveBeenLastCalledWith("/api/tickets", {
        params: expect.objectContaining({ category: TicketCategory.technical_question }),
      });
    });
  });
});
