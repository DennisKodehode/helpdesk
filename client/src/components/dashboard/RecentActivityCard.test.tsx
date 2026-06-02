import { AuditEventType, type RecentActivityResponse } from "@helpdesk/core";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@/lib/auth-client";
import { cleanup, renderWithProviders, screen } from "../../test/utils";
import RecentActivityCard from "./RecentActivityCard";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn() }));

function setRole(role: "admin" | "agent") {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { role } },
    isPending: false,
  } as unknown as ReturnType<typeof useSession>);
}

const ROWS: RecentActivityResponse = [
  {
    id: "a1",
    type: AuditEventType.auto_resolved,
    ticketId: 41,
    ticketSubject: "Refund for duplicate charge",
    actorName: null,
    data: {},
    createdAt: new Date().toISOString(),
  },
  {
    id: "a2",
    type: AuditEventType.status_changed,
    ticketId: 42,
    ticketSubject: "Login broken",
    actorName: "Alice Agent",
    data: { from: "open", to: "resolved" },
    createdAt: new Date().toISOString(),
  },
];

beforeEach(() => setRole("agent"));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RecentActivityCard", () => {
  it("renders activity rows with summary, ticket link, and subject", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: ROWS });
    renderWithProviders(<RecentActivityCard />);
    expect(await screen.findByText(/AI auto-resolved/i)).toBeInTheDocument();
    expect(screen.getByText("Refund for duplicate charge")).toBeInTheDocument();
    expect(screen.getByText(/Alice Agent changed status/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "#0042" });
    expect(link).toHaveAttribute("href", "/tickets/42");
  });

  it("renders an empty state when there is no activity", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    renderWithProviders(<RecentActivityCard />);
    expect(await screen.findByText(/no activity yet/i)).toBeInTheDocument();
  });

  it("shows a 'View all' link to admins", async () => {
    setRole("admin");
    vi.mocked(axios.get).mockResolvedValue({ data: ROWS });
    renderWithProviders(<RecentActivityCard />);
    const link = await screen.findByRole("link", { name: /view all/i });
    expect(link).toHaveAttribute("href", "/activity");
  });

  it("hides the 'View all' link from non-admins", async () => {
    setRole("agent");
    vi.mocked(axios.get).mockResolvedValue({ data: ROWS });
    renderWithProviders(<RecentActivityCard />);
    await screen.findByText(/AI auto-resolved/i);
    expect(screen.queryByRole("link", { name: /view all/i })).not.toBeInTheDocument();
  });
});
