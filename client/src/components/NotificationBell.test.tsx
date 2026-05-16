import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import NotificationBell from "./NotificationBell";
import { useSession } from "@/lib/auth-client";
import { NotificationType, type NotificationsResponse } from "@helpdesk/core";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), isAxiosError: vi.fn() },
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

afterEach(cleanup);

function mockSession(active = true) {
  vi.mocked(useSession).mockReturnValue(
    (active ? { data: { user: { id: "user-1", name: "Tester" } } } : { data: null }) as unknown as ReturnType<typeof useSession>,
  );
}

function mockNotificationsResponse(payload: NotificationsResponse) {
  vi.mocked(axios.get).mockResolvedValue({ data: payload });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession(true);
});

describe("NotificationBell", () => {
  it("renders nothing when there is no session", () => {
    mockSession(false);
    const { container } = renderWithProviders(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render an unread badge when unreadCount is 0", async () => {
    mockNotificationsResponse({ data: [], unreadCount: 0 });
    renderWithProviders(<NotificationBell />);
    const btn = await screen.findByRole("button", { name: /notifications/i });
    expect(btn).toHaveAccessibleName("Notifications");
  });

  it("shows the unread count in the bell button aria-label and badge", async () => {
    mockNotificationsResponse({ data: [], unreadCount: 3 });
    renderWithProviders(<NotificationBell />);
    const btn = await screen.findByRole("button", { name: /notifications \(3 unread\)/i });
    expect(btn).toHaveTextContent("3");
  });

  it("caps the badge text at '9+' when unreadCount is over 9", async () => {
    mockNotificationsResponse({ data: [], unreadCount: 42 });
    renderWithProviders(<NotificationBell />);
    const btn = await screen.findByRole("button", { name: /42 unread/i });
    expect(btn).toHaveTextContent("9+");
  });

  it("opens the dropdown on click and shows 'You're all caught up.' when empty", async () => {
    mockNotificationsResponse({ data: [], unreadCount: 0 });
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(await screen.findByText(/you're all caught up/i)).toBeInTheDocument();
  });

  it("lists notifications with type label, ticket reference, and unread styling", async () => {
    mockNotificationsResponse({
      data: [
        {
          id: "n1",
          type: NotificationType.customer_reply,
          ticketId: 42,
          ticketSubject: "Printer broken",
          actorName: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: "n2",
          type: NotificationType.ticket_assigned,
          ticketId: 43,
          ticketSubject: "Billing question",
          actorName: "Alice",
          readAt: new Date().toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
      unreadCount: 1,
    });
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications/i }));

    expect(await screen.findByText(/customer replied/i)).toBeInTheDocument();
    expect(screen.getByText(/#42 · Printer broken/)).toBeInTheDocument();
    expect(screen.getByText(/Alice assigned you a ticket/i)).toBeInTheDocument();
    expect(screen.getByText(/#43 · Billing question/)).toBeInTheDocument();
  });

  it("marks an unread notification as read when clicked", async () => {
    mockNotificationsResponse({
      data: [
        {
          id: "n1",
          type: NotificationType.customer_reply,
          ticketId: 42,
          ticketSubject: "Printer broken",
          actorName: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });
    vi.mocked(axios.patch).mockResolvedValue({ status: 204 });

    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications/i }));
    const item = await screen.findByRole("menuitem", { name: /customer replied/i });
    await user.click(item);

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/notifications/n1/read");
    });
  });

  it("does not call mark-read when clicking an already-read notification", async () => {
    mockNotificationsResponse({
      data: [
        {
          id: "n1",
          type: NotificationType.customer_reply,
          ticketId: 42,
          ticketSubject: "Printer broken",
          actorName: null,
          readAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 0,
    });

    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications/i }));
    await user.click(await screen.findByRole("menuitem", { name: /customer replied/i }));

    expect(axios.patch).not.toHaveBeenCalled();
  });

  it("calls mark-all-read when the 'Mark all as read' button is clicked", async () => {
    mockNotificationsResponse({
      data: [
        {
          id: "n1",
          type: NotificationType.customer_reply,
          ticketId: 42,
          ticketSubject: "Printer broken",
          actorName: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });
    vi.mocked(axios.post).mockResolvedValue({ data: { markedCount: 1 } });

    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications/i }));
    await user.click(await screen.findByRole("button", { name: /mark all as read/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/notifications/mark-all-read");
    });
  });

  it("disables 'Mark all as read' when there are no unread notifications", async () => {
    mockNotificationsResponse({ data: [], unreadCount: 0 });
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications/i }));
    expect(await screen.findByRole("button", { name: /mark all as read/i })).toBeDisabled();
  });
});
