import { type Notification, NotificationType } from "@helpdesk/core";
import { AlertTriangle, Bell, MailOpen, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "@/lib/auth-client";
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
  className?: string;
  /**
   * Which edge of the bell the dropdown aligns to.
   * - "end" (default): right-edge anchored, dropdown grows leftward. Use when the bell sits at the right edge of a container (mobile topbar).
   * - "start": left-edge anchored, dropdown grows rightward. Use inside a left-pinned sidebar so the menu opens into the main content area instead of overflowing the sidebar.
   */
  align?: "start" | "end";
}

export default function NotificationBell({ className, align = "end" }: Props) {
  const { data: session } = useSession();
  const enabled = !!session;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useNotifications(enabled);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.data ?? [];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleItemClick(n: Notification) {
    if (!n.readAt) {
      markRead.mutate(n.id);
    }
    setOpen(false);
    navigate(`/tickets/${n.ticketId}`);
  }

  function handleMarkAllRead() {
    if (unreadCount === 0) return;
    markAllRead.mutate();
  }

  if (!enabled) return null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={
          unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground"
            style={{ height: 16 }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-border bg-popover shadow-[0_8px_30px_-12px_rgb(0_0_0_/_0.18)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="eyebrow text-[11px]">Notifications</p>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || markAllRead.isPending}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                You're all caught up.
              </p>
            ) : (
              <ul>
                {items.map((n) => {
                  // Guard against unknown notification types — keeps a stale
                  // bundle (post-deploy) from crashing when the server adds
                  // a new NotificationType value the bundle doesn't know.
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
                          "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/60",
                          unread && "bg-accent/30",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                            unread
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-foreground">
                            {label}
                          </span>
                          <span className="block truncate text-[12px] text-muted-foreground">
                            #{n.ticketId} · {n.ticketSubject}
                          </span>
                          <span className="block text-[11px] text-muted-foreground/80">
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
        </div>
      )}
    </div>
  );
}
