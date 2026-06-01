import {
  type AiActivityResponse,
  Role,
  type RosterAgent,
  UserStatus,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import UsersPage from "./UsersPage";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const ROSTER: RosterAgent[] = [
  {
    id: "a1",
    name: "Alice Agent",
    email: "alice@example.com",
    role: Role.agent,
    status: UserStatus.active,
    openAssigned: 3,
    resolved30d: 10,
    avgResolutionMinutes: 120,
    lastActiveAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "a2",
    name: "Mara Admin",
    email: "mara@example.com",
    role: Role.admin,
    status: UserStatus.active,
    openAssigned: 1,
    resolved30d: 5,
    avgResolutionMinutes: null,
    lastActiveAt: null,
  },
  {
    id: "a3",
    name: "Ivy Invited",
    email: "ivy@example.com",
    role: Role.agent,
    status: UserStatus.invited,
    openAssigned: 0,
    resolved30d: 0,
    avgResolutionMinutes: null,
    lastActiveAt: null,
  },
];

const AI: AiActivityResponse = {
  autoResolved: 14,
  autoClassified: 96,
  escalated: 5,
  repliesSent: 41,
};

function mockGet() {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/users/roster") return Promise.resolve({ data: ROSTER });
    if (url === "/api/stats/ai-activity") return Promise.resolve({ data: AI });
    return Promise.resolve({ data: [] });
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// The roster renders both a desktop table and a mobile card list, so each name
// appears twice in jsdom — query with getAllByText.
describe("UsersPage (Agents roster)", () => {
  it("renders the roster, summary cards, and footer count", async () => {
    mockGet();
    renderWithProviders(<UsersPage />);
    expect((await screen.findAllByText("Alice Agent")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mara Admin").length).toBeGreaterThan(0);
    expect(screen.getByText("Team members")).toBeInTheDocument();
    expect(screen.getByText(/3 members shown/i)).toBeInTheDocument();
  });

  it("filters the roster by search query", async () => {
    mockGet();
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    await screen.findAllByText("Alice Agent");
    await user.type(screen.getByLabelText("Search agents"), "mara");
    expect(screen.queryAllByText("Alice Agent")).toHaveLength(0);
    expect(screen.getAllByText("Mara Admin").length).toBeGreaterThan(0);
  });

  it("opens the invite dialog", async () => {
    mockGet();
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);
    await screen.findAllByText("Alice Agent");
    await user.click(screen.getByRole("button", { name: /invite agent/i }));
    expect(await screen.findByText("Invite an agent")).toBeInTheDocument();
  });
});
