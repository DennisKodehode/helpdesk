import {
  type Agent,
  TicketCategory,
  type TicketDetail,
  TicketPriority,
  TicketStatus,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@/lib/auth-client";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import TicketMeta from "./TicketMeta";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

afterEach(cleanup);

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
  assignedToId: "agent-1",
  assignedTo: { id: "agent-1", name: "Bob Agent", email: "bob@example.com" },
  assigneeType: "human",
  isSuppressed: false,
  hasKbSuggestion: false,
  attachments: [],
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T11:00:00Z",
  firstAgentReplyAt: null,
  resolvedAt: null,
};

const mockAgents: Agent[] = [
  { id: "agent-1", name: "Bob Agent", email: "bob@example.com" },
  { id: "agent-2", name: "Carol Agent", email: "carol@example.com" },
];

function mockGetResponses(agents = mockAgents) {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/agents") return Promise.resolve({ data: agents });
    return Promise.resolve({ data: [] });
  });
}

function mockSession(role = "agent") {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { role } },
  } as unknown as ReturnType<typeof useSession>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetResponses();
  mockSession("agent");
});

describe("TicketMeta", () => {
  it("shows the current status as a pill with its primary action", async () => {
    renderWithProviders(<TicketMeta ticket={mockTicket} />);
    // Agent on an open ticket: status pill + a single "Resolve" action.
    expect(await screen.findByText("Open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
  });

  it("shows the current category in the category select", async () => {
    renderWithProviders(<TicketMeta ticket={mockTicket} />);
    expect(
      await screen.findByRole("combobox", { name: /change ticket category/i }),
    ).toHaveTextContent("Technical");
  });

  it("shows None placeholder when category is null", async () => {
    renderWithProviders(<TicketMeta ticket={{ ...mockTicket, category: null }} />);
    expect(
      await screen.findByRole("combobox", { name: /change ticket category/i }),
    ).toHaveTextContent(/none/i);
  });

  it("shows a static status badge (no select) when ticket is closed and user is not admin", async () => {
    renderWithProviders(
      <TicketMeta ticket={{ ...mockTicket, status: TicketStatus.closed }} />,
    );
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith(
        "/api/agents",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(
      screen.queryByRole("combobox", { name: /change ticket status/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("shows a Reopen action for closed ticket when user is admin", async () => {
    mockSession("admin");
    renderWithProviders(
      <TicketMeta ticket={{ ...mockTicket, status: TicketStatus.closed }} />,
    );
    expect(await screen.findByRole("button", { name: "Reopen" })).toBeInTheDocument();
  });

  it("shows a static status badge for resolved ticket when user is not admin", async () => {
    renderWithProviders(
      <TicketMeta ticket={{ ...mockTicket, status: TicketStatus.resolved }} />,
    );
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith(
        "/api/agents",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(
      screen.queryByRole("combobox", { name: /change ticket status/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("shows Reopen and Close actions for resolved ticket when user is admin", async () => {
    mockSession("admin");
    renderWithProviders(
      <TicketMeta ticket={{ ...mockTicket, status: TicketStatus.resolved }} />,
    );
    // Admin on resolved: primary Reopen (→ open) + Close (→ closed) overflow.
    expect(await screen.findByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("shows a Close overflow action for admin on an open ticket", async () => {
    mockSession("admin");
    renderWithProviders(<TicketMeta ticket={mockTicket} />);
    // Admin on open: primary Resolve (→ resolved) + Close (→ closed) overflow.
    expect(await screen.findByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("shows the current assignee name in the assign select trigger", async () => {
    renderWithProviders(<TicketMeta ticket={mockTicket} />);
    expect(
      await screen.findByRole("combobox", { name: /assign ticket/i }),
    ).toHaveTextContent("Bob Agent");
  });

  it("shows Unassigned placeholder when assignedTo is null", async () => {
    renderWithProviders(
      <TicketMeta ticket={{ ...mockTicket, assignedToId: null, assignedTo: null }} />,
    );
    expect(
      await screen.findByRole("combobox", { name: /assign ticket/i }),
    ).toHaveTextContent(/unassigned/i);
  });

  it("fetches the agents list", async () => {
    renderWithProviders(<TicketMeta ticket={mockTicket} />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/agents",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });
});

describe("status interaction", () => {
  it("calls PATCH with the new status when the primary action is clicked", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...mockTicket, status: TicketStatus.resolved },
    });
    const user = userEvent.setup();
    renderWithProviders(<TicketMeta ticket={mockTicket} />);

    await user.click(await screen.findByRole("button", { name: "Resolve" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", {
        status: TicketStatus.resolved,
      });
    });
  });

  it("calls PATCH with the overflow transition (admin force-close)", async () => {
    mockSession("admin");
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...mockTicket, status: TicketStatus.closed },
    });
    const user = userEvent.setup();
    renderWithProviders(<TicketMeta ticket={mockTicket} />);

    await user.click(await screen.findByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", {
        status: TicketStatus.closed,
      });
    });
  });
});

describe("category interaction", () => {
  it("calls PATCH with the selected category", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...mockTicket, category: TicketCategory.billing_inquiry },
    });
    const user = userEvent.setup();
    renderWithProviders(<TicketMeta ticket={mockTicket} />);

    await user.click(
      await screen.findByRole("combobox", { name: /change ticket category/i }),
    );
    await user.click(await screen.findByRole("option", { name: "Billing" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", {
        category: TicketCategory.billing_inquiry,
      });
    });
  });

  it("calls PATCH with null when None is selected", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...mockTicket, category: null },
    });
    const user = userEvent.setup();
    renderWithProviders(<TicketMeta ticket={mockTicket} />);

    await user.click(
      await screen.findByRole("combobox", { name: /change ticket category/i }),
    );
    await user.click(await screen.findByRole("option", { name: /none/i }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", { category: null });
    });
  });
});

describe("priority interaction", () => {
  it("shows the current priority in the priority select", async () => {
    renderWithProviders(<TicketMeta ticket={mockTicket} />);
    expect(
      await screen.findByRole("combobox", { name: /change ticket priority/i }),
    ).toHaveTextContent("Normal");
  });

  it("calls PATCH with the selected priority", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...mockTicket, priority: TicketPriority.urgent },
    });
    const user = userEvent.setup();
    renderWithProviders(<TicketMeta ticket={mockTicket} />);

    await user.click(
      await screen.findByRole("combobox", { name: /change ticket priority/i }),
    );
    await user.click(await screen.findByRole("option", { name: "Urgent" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", {
        priority: TicketPriority.urgent,
      });
    });
  });
});

describe("assigneeType display", () => {
  it("renders 'AI Agent' label when assigneeType is 'ai'", async () => {
    renderWithProviders(
      <TicketMeta
        ticket={{
          ...mockTicket,
          assigneeType: "ai",
          assignedTo: { id: "ai-id", name: "AI", email: "ai@helpdesk.internal" },
          assignedToId: "ai-id",
        }}
      />,
    );
    const trigger = await screen.findByRole("combobox", { name: /assign ticket/i });
    expect(trigger).toHaveTextContent("AI Agent");
  });

  it("renders the human agent name when assigneeType is 'human'", async () => {
    renderWithProviders(<TicketMeta ticket={mockTicket} />);
    const trigger = await screen.findByRole("combobox", { name: /assign ticket/i });
    expect(trigger).toHaveTextContent("Bob Agent");
    expect(trigger).not.toHaveTextContent("AI Agent");
  });
});

describe("assign interaction", () => {
  it("calls PATCH with the selected agent id", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: {
        ...mockTicket,
        assignedToId: "agent-2",
        assignedTo: { id: "agent-2", name: "Carol Agent", email: "carol@example.com" },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<TicketMeta ticket={mockTicket} />);

    await user.click(await screen.findByRole("combobox", { name: /assign ticket/i }));
    await user.click(await screen.findByRole("option", { name: "Carol Agent" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", {
        assignedToId: "agent-2",
      });
    });
  });

  it("calls PATCH with null when Unassigned is selected", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...mockTicket, assignedToId: null, assignedTo: null },
    });
    const user = userEvent.setup();
    renderWithProviders(<TicketMeta ticket={mockTicket} />);

    await user.click(await screen.findByRole("combobox", { name: /assign ticket/i }));
    await user.click(await screen.findByRole("option", { name: /unassigned/i }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/tickets/42", { assignedToId: null });
    });
  });

  it("disables the assign select on resolved tickets and shows the reopen hint", async () => {
    renderWithProviders(
      <TicketMeta ticket={{ ...mockTicket, status: TicketStatus.resolved }} />,
    );
    const trigger = await screen.findByRole("combobox", { name: /assign ticket/i });
    expect(trigger).toBeDisabled();
    expect(screen.getByText(/reopen the ticket to reassign/i)).toBeInTheDocument();
  });

  it("disables the assign select on closed tickets and shows the reopen hint", async () => {
    renderWithProviders(
      <TicketMeta ticket={{ ...mockTicket, status: TicketStatus.closed }} />,
    );
    const trigger = await screen.findByRole("combobox", { name: /assign ticket/i });
    expect(trigger).toBeDisabled();
    expect(screen.getByText(/reopen the ticket to reassign/i)).toBeInTheDocument();
  });

  it("does not show the reopen hint on open tickets", async () => {
    renderWithProviders(<TicketMeta ticket={mockTicket} />);
    await screen.findByRole("combobox", { name: /assign ticket/i });
    expect(screen.queryByText(/reopen the ticket to reassign/i)).not.toBeInTheDocument();
  });
});
