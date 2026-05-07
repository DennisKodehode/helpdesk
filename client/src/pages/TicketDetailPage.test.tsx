import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import TicketDetailPage from "./TicketDetailPage";
import { TicketStatus, TicketCategory, type TicketDetail, type Agent } from "@helpdesk/core";
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
  status: TicketStatus.open,
  category: TicketCategory.technical_question,
  assignedToId: "agent-1",
  assignedTo: { id: "agent-1", name: "Bob Agent", email: "bob@example.com" },
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T11:00:00Z",
};

const mockAgents: Agent[] = [
  { id: "agent-1", name: "Bob Agent", email: "bob@example.com" },
  { id: "agent-2", name: "Carol Agent", email: "carol@example.com" },
];

function mockGetResponses(ticket = mockTicket, agents = mockAgents) {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/agents") return Promise.resolve({ data: agents });
    return Promise.resolve({ data: ticket });
  });
}

function mockSession(role = "agent") {
  vi.mocked(useSession).mockReturnValue({ data: { user: { role } } } as ReturnType<typeof useSession>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetResponses();
  mockSession("agent");
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

  it("shows the current status in the status select", async () => {
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByRole("combobox", { name: /change ticket status/i })).toHaveTextContent("Open");
  });

  it("shows the current category in the category select", async () => {
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByRole("combobox", { name: /change ticket category/i })).toHaveTextContent("Technical");
  });

  it("shows None placeholder when category is null", async () => {
    mockGetResponses({ ...mockTicket, category: null });
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByRole("combobox", { name: /change ticket category/i })).toHaveTextContent(/none/i);
  });

  it("shows a static status badge (no select) when ticket is closed and user is not admin", async () => {
    mockGetResponses({ ...mockTicket, status: TicketStatus.closed });
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.queryByRole("combobox", { name: /change ticket status/i })).not.toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("shows status select for closed ticket when user is admin", async () => {
    mockGetResponses({ ...mockTicket, status: TicketStatus.closed });
    mockSession("admin");
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByRole("combobox", { name: /change ticket status/i })).toBeInTheDocument();
  });

  it("shows a static status badge for resolved ticket when user is not admin", async () => {
    mockGetResponses({ ...mockTicket, status: TicketStatus.resolved });
    mockSession("agent");
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.queryByRole("combobox", { name: /change ticket status/i })).not.toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("shows status select for resolved ticket when user is admin", async () => {
    mockGetResponses({ ...mockTicket, status: TicketStatus.resolved });
    mockSession("admin");
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByRole("combobox", { name: /change ticket status/i })).toBeInTheDocument();
  });

  it("shows Closed as an option for admin on an open ticket", async () => {
    mockGetResponses({ ...mockTicket, status: TicketStatus.open });
    mockSession("admin");
    const user = userEvent.setup();
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });

    await user.click(screen.getByRole("combobox", { name: /change ticket status/i }));
    expect(await screen.findByRole("option", { name: "Closed" })).toBeInTheDocument();
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

  it("shows the current assignee name in the assign select trigger", async () => {
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByRole("combobox", { name: /assign ticket/i })).toHaveTextContent("Bob Agent");
  });

  it("shows Unassigned placeholder when assignedTo is null", async () => {
    mockGetResponses({ ...mockTicket, assignedToId: null, assignedTo: null });
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByRole("combobox", { name: /assign ticket/i })).toHaveTextContent(/unassigned/i);
  });

  it("shows fallback text when body is empty", async () => {
    mockGetResponses({ ...mockTicket, body: "" });
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });
    expect(screen.getByText("(no message body)")).toBeInTheDocument();
  });

  it("fetches from the correct ticket endpoint", async () => {
    renderWithProviders(<TicketDetailPage />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/tickets/42");
    });
  });

  it("fetches the agents list", async () => {
    renderWithProviders(<TicketDetailPage />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/agents");
    });
  });
});

describe("status interaction", () => {
  it("calls PATCH with the new status when status is changed", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...mockTicket, status: TicketStatus.resolved },
    });
    const user = userEvent.setup();
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });

    await user.click(screen.getByRole("combobox", { name: /change ticket status/i }));
    await user.click(await screen.findByRole("option", { name: "Resolved" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", { status: TicketStatus.resolved });
    });
  });
});

describe("category interaction", () => {
  it("calls PATCH with the selected category", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...mockTicket, category: TicketCategory.billing_inquiry },
    });
    const user = userEvent.setup();
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });

    await user.click(screen.getByRole("combobox", { name: /change ticket category/i }));
    await user.click(await screen.findByRole("option", { name: "Billing" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", { category: TicketCategory.billing_inquiry });
    });
  });

  it("calls PATCH with null when None is selected", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...mockTicket, category: null },
    });
    const user = userEvent.setup();
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });

    await user.click(screen.getByRole("combobox", { name: /change ticket category/i }));
    await user.click(await screen.findByRole("option", { name: /none/i }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", { category: null });
    });
  });
});

describe("assign interaction", () => {
  it("calls PATCH with the selected agent id", async () => {
    vi.mocked(axios.patch).mockResolvedValue({ data: { ...mockTicket, assignedToId: "agent-2", assignedTo: { id: "agent-2", name: "Carol Agent", email: "carol@example.com" } } });
    const user = userEvent.setup();
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });

    await user.click(screen.getByRole("combobox", { name: /assign ticket/i }));
    await user.click(await screen.findByRole("option", { name: "Carol Agent" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", { assignedToId: "agent-2" });
    });
  });

  it("calls PATCH with null when Unassigned is selected", async () => {
    vi.mocked(axios.patch).mockResolvedValue({ data: { ...mockTicket, assignedToId: null, assignedTo: null } });
    const user = userEvent.setup();
    renderWithProviders(<TicketDetailPage />);
    await screen.findByRole("heading", { name: "My printer is on fire" });

    await user.click(screen.getByRole("combobox", { name: /assign ticket/i }));
    await user.click(await screen.findByRole("option", { name: /unassigned/i }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", { assignedToId: null });
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
