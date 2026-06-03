import { type Notification, NotificationType } from "@helpdesk/core";
import { AlertTriangle, Bell, MailOpen, UserPlus } from "lucide-react";
import { useNavigate } from "react-router";
import {
  NOTIFICATION_TYPE_LABEL,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/notifications";
import { formatRelative } from "@/lib/ticket-ui";
import { cn } from "@/lib/utils";

const ICON_FOR_TYPE: Record<
  NotificationType,
  React.ComponentType<{ className?: string }>
> = {
  [NotificationType.customer_reply]: MailOpen,
  [NotificationType.ticket_assigned]: UserPlus,
  [NotificationType.sla_breach_warning]: AlertTriangle,
};

interface Props {
  /**
   * Whether the notification query should run. Containers pass their own
   * session-gated flag so the list never fires a request before auth resolves
   * (mirrors the gating `NotificationBell` already applies to the unread dot).
   */
  enabled: boolean;
  /**
   * Invoked after an item is activated (navigation happens here too) so the
   * container can dismiss itself — popover, rail popover, or full-screen sheet.
   */
  onClose: () => void;
}

/**
 * The notification body — mark-all header + scrollable item list + empty state.
 * Container-agnostic so it can sit inside the desktop popover, the tablet
 * icon-rail popover, and the mobile full-screen sheet from one data path. The
 * unread dot on the trigger button lives with each container (it stays mounted
 * for polling); this list reuses the same cached query.
 */
export default function NotificationList({ enabled, onClose }: Props) {
  const navigate = useNavigate();
  const { data } = useNotifications(enabled);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.data ?? [];

  function handleItemClick(n: Notification) {
    if (!n.readAt) {
      markRead.mutate(n.id);
    }
    onClose();
    navigate(`/tickets/${n.ticketId}`);
  }

  function handleMarkAllRead() {
    if (unreadCount === 0) return;
    markAllRead.mutate();
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <p className="eyebrow">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-accent-ink normal-case tracking-normal">
              {unreadCount} new
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || markAllRead.isPending}
          className="text-[11px] text-ink-3 transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40"
        >
          Mark all as read
        </button>
      </div>

      <div className="max-h-[340px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-ink-3">
            You're all caught up.
          </p>
        ) : (
          <ul>
            {items.map((n) => {
              // Guard against unknown notification types — keeps a stale bundle
              // (post-deploy) from crashing when the server adds a new
              // NotificationType value the bundle doesn't know.
              const Icon = ICON_FOR_TYPE[n.type] ?? Bell;
              const formatter = NOTIFICATION_TYPE_LABEL[n.type];
              const label = formatter ? formatter(n) : "Notification";
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-panel-2",
                      unread && "bg-accent-tint",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                        unread
                          ? "bg-accent-tint-2 text-accent-ink"
                          : "bg-panel-2 text-ink-3",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-foreground">
                        {label}
                      </span>
                      <span className="block truncate text-[12.5px] text-ink-3">
                        #{n.ticketId} · {n.ticketSubject}
                      </span>
                      <span className="block font-mono text-[10.5px] text-ink-4">
                        {formatRelative(n.createdAt)}
                      </span>
                    </span>
                    {unread && (
                      <span
                        role="img"
                        aria-label="Unread"
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
