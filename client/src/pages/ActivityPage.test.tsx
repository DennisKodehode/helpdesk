import { type AuditEventRow, AuditEventType } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderWithProviders, screen, waitFor } from "../test/utils";
import ActivityPage from "./ActivityPage";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const ROW: AuditEventRow = {
  id: "e1",
  type: AuditEventType.status_changed,
  ticketId: 42,
  ticketSubject: "Login broken",
  actorName: "Alice Agent",
  data: {},
  createdAt: new Date().toISOString(),
};

function mockApi({
  events = [] as AuditEventRow[],
  total = 0,
  rejectAudit = false,
} = {}) {
  vi.mocked(axios.get).mockImplementation((url: string) => {
    if (url === "/api/users/roster") return Promise.resolve({ data: [] });
    if (url === "/api/audit-events") {
      return rejectAudit
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ data: { data: events, total, page: 1, pageSize: 25 } });
    }
    return Promise.resolve({ data: {} });
  });
}

function auditCalls() {
  return vi.mocked(axios.get).mock.calls.filter((c) => c[0] === "/api/audit-events");
}

beforeEach(() => mockApi());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ActivityPage", () => {
  it("sends the URL filters as query params", async () => {
    mockApi({ events: [ROW], total: 1 });
    renderWithProviders(<ActivityPage />, {
      initialEntries: [
        "/activity?type=status_changed&actorId=ai&from=2026-05-01&to=2026-05-31&page=2",
      ],
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/audit-events",
        expect.objectContaining({
          params: expect.objectContaining({
            type: "status_changed",
            actorId: "ai",
            from: "2026-05-01",
            to: "2026-05-31",
            page: 2,
          }),
        }),
      );
    });
  });

  it("renders the loaded rows", async () => {
    mockApi({ events: [ROW], total: 1 });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity"] });
    expect(await screen.findByText(/Alice Agent changed status/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#0042" })).toBeInTheDocument();
  });

  it("renders an empty state", async () => {
    mockApi({ events: [], total: 0 });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity"] });
    expect(
      await screen.findByText(/no activity matches these filters/i),
    ).toBeInTheDocument();
  });

  it("renders an error state", async () => {
    mockApi({ rejectAudit: true });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity"] });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed to load activity/i,
    );
  });

  it("paginates: Next refetches with the incremented page", async () => {
    mockApi({ events: [ROW], total: 60 });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity?page=2"] });
    await screen.findByText(/Alice Agent changed status/i);

    await userEvent.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() => {
      expect(
        auditCalls().some(
          (c) => (c[1] as { params: { page: number } }).params.page === 3,
        ),
      ).toBe(true);
    });
  });

  it("changing a filter refetches and resets to page 1", async () => {
    mockApi({ events: [ROW], total: 1 });
    renderWithProviders(<ActivityPage />, { initialEntries: ["/activity?page=3"] });
    await screen.findByText(/Alice Agent changed status/i);

    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-06-15" },
    });

    await waitFor(() => {
      expect(
        auditCalls().some((c) => {
          const params = (c[1] as { params: { from?: string; page: number } }).params;
          return params.from === "2026-06-15" && params.page === 1;
        }),
      ).toBe(true);
    });
  });
});
