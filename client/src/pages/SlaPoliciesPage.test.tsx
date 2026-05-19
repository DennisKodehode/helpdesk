import { TicketPriority } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor, within } from "../test/utils";
import SlaPoliciesPage from "./SlaPoliciesPage";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const FOUR_POLICIES = [
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
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: FOUR_POLICIES });
});

afterEach(cleanup);

describe("SlaPoliciesPage", () => {
  it("renders one row per priority with formatted minutes", async () => {
    renderWithProviders(<SlaPoliciesPage />);
    expect(await screen.findByText(/Urgent/)).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();

    // Scope to the urgent row: first-response = 60min → "1h", resolution = 240min → "4h".
    const urgentRow = screen.getByText("Urgent").closest("tr") as HTMLElement;
    expect(within(urgentRow).getByText("1h")).toBeInTheDocument();
    expect(within(urgentRow).getByText("4h")).toBeInTheDocument();

    // low resolution = null → "—" (em dash)
    const lowRow = screen.getByText("Low").closest("tr") as HTMLElement;
    expect(within(lowRow).getByText("—")).toBeInTheDocument();
  });

  it("opens the edit dialog when the Edit button on a row is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SlaPoliciesPage />);
    const urgentRow = (await screen.findByText("Urgent")).closest("tr");
    expect(urgentRow).not.toBeNull();
    await user.click(
      within(urgentRow as HTMLElement).getByRole("button", { name: /edit/i }),
    );
    expect(
      await screen.findByRole("heading", { name: /edit urgent priority sla/i }),
    ).toBeInTheDocument();
  });

  it("closes the dialog after a successful save and refetches the list", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...FOUR_POLICIES[0], firstResponseMinutes: 30 },
    });
    const user = userEvent.setup();
    renderWithProviders(<SlaPoliciesPage />);
    const urgentRow = (await screen.findByText("Urgent")).closest("tr");
    await user.click(
      within(urgentRow as HTMLElement).getByRole("button", { name: /edit/i }),
    );

    const frInput = await screen.findByLabelText(/first-response target/i);
    await user.clear(frInput);
    await user.type(frInput, "30");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/sla-policies/urgent", {
        firstResponseMinutes: 30,
        resolutionMinutes: 240,
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /edit urgent priority sla/i }),
      ).not.toBeInTheDocument();
    });
    // Refetched (initial + post-mutation invalidation = 2 calls)
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it("shows the error alert when the policies query fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("nope"));
    renderWithProviders(<SlaPoliciesPage />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
