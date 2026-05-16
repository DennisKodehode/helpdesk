import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import TicketDetailPage from "./TicketDetailPage";
import { TicketStatus, TicketCategory, TicketPriority, type TicketDetail } from "@helpdesk/core";
import { useSession } from "@/lib/auth-client";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), isAxiosError: vi.fn() },
}));

vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>();
  return { ...mod, useParams: () => ({ id: "42" }) };
});

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

const mockTicket: TicketDetail = {
  id: 42,
  fromName: "Alice Smith",
  fromEmail: "alice@example.com",
  subject: "My printer is on fire",
  body: "It started smoking and then caught fire.",
  bodyHtml: null,
  status: TicketStatus.open,
  category: TicketCategory.technical_question,
  priority: TicketPriority.normal,
  assignedToId: null,
  assignedTo: null,
  assigneeType: "none",
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T11:00:00Z",
};

function mockGetResponses(ticket = mockTicket) {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/agents") return Promise.resolve({ data: [] });
    if (url === "/api/tickets/42/replies") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: ticket });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetResponses();
  vi.mocked(useSession).mockReturnValue({ data: { user: { role: "agent" } } } as unknown as ReturnType<typeof useSession>);
});

afterEach(cleanup);

describe("loading state", () => {
  it("shows skeleton while loading", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<TicketDetailPage />);
    expect(document.querySelector('[aria-label="Loading ticket"]')).toBeInTheDocument();
    expect(screen.queryByText("My printer is on fire")).not.toBeInTheDocument();
  });
});

describe("loaded state", () => {
  it("renders the back link", () => {
    renderWithProviders(<TicketDetailPage />);
    expect(screen.getByRole("link", { name: /all tickets/i })).toBeInTheDocument();
  });

  it("fetches from the correct ticket endpoint", async () => {
    renderWithProviders(<TicketDetailPage />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/tickets/42");
    });
  });
});

describe("error state", () => {
  it("shows an error message when the fetch fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("Network error"));
    renderWithProviders(<TicketDetailPage />);
    expect(await screen.findByText("Failed to load ticket")).toBeInTheDocument();
  });
});

describe("triaging state", () => {
  it("hides the reply form and shows the AI triage explainer when status is new", async () => {
    mockGetResponses({ ...mockTicket, status: TicketStatus.new });
    renderWithProviders(<TicketDetailPage />);

    await screen.findByText("My printer is on fire");
    expect(screen.queryByRole("form", { name: /reply form/i })).not.toBeInTheDocument();
    expect(screen.getByText(/AI is triaging this ticket/i)).toBeInTheDocument();
  });

  it("hides the reply form and shows the explainer when status is processing", async () => {
    mockGetResponses({ ...mockTicket, status: TicketStatus.processing });
    renderWithProviders(<TicketDetailPage />);

    await screen.findByText("My printer is on fire");
    expect(screen.queryByRole("form", { name: /reply form/i })).not.toBeInTheDocument();
    expect(screen.getByText(/AI is triaging this ticket/i)).toBeInTheDocument();
  });

  it("shows the reply form when status is open", async () => {
    renderWithProviders(<TicketDetailPage />);
    expect(await screen.findByRole("form", { name: /reply form/i })).toBeInTheDocument();
    expect(screen.queryByText(/AI is triaging this ticket/i)).not.toBeInTheDocument();
  });
});
