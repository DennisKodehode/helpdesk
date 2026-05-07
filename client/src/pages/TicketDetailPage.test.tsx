import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import TicketDetailPage from "./TicketDetailPage";
import { TicketStatus, TicketCategory, type TicketDetail } from "@helpdesk/core";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), isAxiosError: vi.fn() },
}));

vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>();
  return { ...mod, useParams: () => ({ id: "42" }) };
});

const mockTicket: TicketDetail = {
  id: 42,
  fromName: "Alice Smith",
  fromEmail: "alice@example.com",
  subject: "My printer is on fire",
  body: "It started smoking and then caught fire.",
  status: TicketStatus.open,
  category: TicketCategory.technical_question,
  assignedToId: "agent-1",
  assignedTo: { id: "agent-1", name: "Bob Agent", email: "bob@example.com" },
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T11:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: mockTicket });
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
  it("renders the ticket subject as a heading", async () => {
    renderWithProviders(<TicketDetailPage />);
    expect(await screen.findByRole("heading", { name: "My printer is on fire" })).toBeInTheDocument();
  });

  it("renders the status badge", async () => {
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByText(TicketStatus.open)).toBeInTheDocument();
  });

  it("renders the category badge", async () => {
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByText("Technical")).toBeInTheDocument();
  });

  it("renders from name and email", async () => {
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("renders the body content", async () => {
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByText("It started smoking and then caught fire.")).toBeInTheDocument();
  });

  it("renders the back link", async () => {
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByRole("link", { name: /back to tickets/i })).toBeInTheDocument();
  });

  it("renders assigned agent name and email", async () => {
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByText("Bob Agent")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("shows Unassigned when assignedTo is null", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { ...mockTicket, assignedToId: null, assignedTo: null } });
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("hides category badge when category is null", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { ...mockTicket, category: null } });
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.queryByText("Technical")).not.toBeInTheDocument();
  });

  it("shows fallback text when body is empty", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { ...mockTicket, body: "" } });
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByText("(no message body)")).toBeInTheDocument();
  });

  it("fetches from the correct endpoint", async () => {
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
