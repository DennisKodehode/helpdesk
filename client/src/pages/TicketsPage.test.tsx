import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import TicketsPage from "./TicketsPage";
import { TicketStatus, type Ticket } from "@helpdesk/core";

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
      expect(axios.get).toHaveBeenCalledWith("/api/tickets", {
        params: { sortBy: "subject", sortOrder: "asc" },
      });
    });
  });
});
