import { NotificationType } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@/lib/auth-client";
import { cleanup, renderWithProviders, screen } from "../../test/utils";
import MobileNotificationSheet from "./MobileNotificationSheet";

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "u1", name: "Agent" } },
    isPending: false,
  } as unknown as ReturnType<typeof useSession>);
});

describe("MobileNotificationSheet", () => {
  it("renders the notification list when open", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        data: [
          {
            id: "n1",
            type: NotificationType.customer_reply,
            ticketId: 12,
            ticketSubject: "Where is my order",
            actorName: null,
            readAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      },
    });
    renderWithProviders(<MobileNotificationSheet open onOpenChange={vi.fn()} />);
    expect(await screen.findByText(/customer replied/i)).toBeInTheDocument();
    expect(screen.getByText(/#12 · Where is my order/)).toBeInTheDocument();
  });

  it("shows the empty state when there are no notifications", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: [], unreadCount: 0 } });
    renderWithProviders(<MobileNotificationSheet open onOpenChange={vi.fn()} />);
    expect(await screen.findByText(/you're all caught up/i)).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when the close button is clicked", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { data: [], unreadCount: 0 } });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<MobileNotificationSheet open onOpenChange={onOpenChange} />);
    await user.click(await screen.findByRole("button", { name: /close/i }));
    // Base UI calls onOpenChange(open, event, details) — assert on the first arg.
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
  });
});
