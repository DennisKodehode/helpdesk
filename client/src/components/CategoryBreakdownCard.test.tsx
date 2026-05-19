import { TicketCategory } from "@helpdesk/core";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import CategoryBreakdownCard from "./CategoryBreakdownCard";

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

describe("CategoryBreakdownCard", () => {
  it("renders a loading skeleton while the query is pending", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<CategoryBreakdownCard />);
    expect(
      screen.getByRole("status", { name: /loading category breakdown/i }),
    ).toBeInTheDocument();
  });

  it("renders rows in the order returned by the server, with labels + counts", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: [
        { category: TicketCategory.refund_request, count: 7 },
        { category: TicketCategory.technical_question, count: 4 },
        { category: TicketCategory.general_question, count: 2 },
      ],
    });
    renderWithProviders(<CategoryBreakdownCard />);
    expect(await screen.findByText(/13 open tickets/i)).toBeInTheDocument();
    const refund = screen.getByRole("link", { name: /refund: 7/i });
    const technical = screen.getByRole("link", { name: /technical: 4/i });
    const general = screen.getByRole("link", { name: /general: 2/i });
    expect(refund).toBeInTheDocument();
    expect(technical).toBeInTheDocument();
    expect(general).toBeInTheDocument();
  });

  it("links non-null rows to /tickets?category=<value>", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: [{ category: TicketCategory.billing_inquiry, count: 3 }],
    });
    renderWithProviders(<CategoryBreakdownCard />);
    const link = await screen.findByRole("link", { name: /billing: 3/i });
    expect(link).toHaveAttribute(
      "href",
      `/tickets?category=${TicketCategory.billing_inquiry}`,
    );
  });

  it("renders the null bucket as 'Uncategorized' linked to the uncategorized filter", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: [
        { category: null, count: 5 },
        { category: TicketCategory.feature_request, count: 1 },
      ],
    });
    renderWithProviders(<CategoryBreakdownCard />);
    const link = await screen.findByRole("link", { name: /uncategorized: 5/i });
    expect(link).toHaveAttribute("href", "/tickets?category=uncategorized");
  });

  it("renders the empty state when no rows are returned", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    renderWithProviders(<CategoryBreakdownCard />);
    expect(await screen.findByText(/no open tickets/i)).toBeInTheDocument();
    expect(screen.getByText(/queue is clear/i)).toBeInTheDocument();
  });

  it("renders an error alert when the query fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("server down"));
    renderWithProviders(<CategoryBreakdownCard />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/server down/),
    );
  });
});
