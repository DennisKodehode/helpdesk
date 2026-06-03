import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import NotificationList from "./NotificationList";

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
  const { data: session, isPending } = useSession();
  // Gate on !isPending so the polling query doesn't fire during the brief
  // window where useSession is still resolving — otherwise we'd kick off a
  // request that the server rejects as 401 and show a phantom error toast.
  const enabled = !isPending && !!session;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // The bell stays mounted while the popover is closed, so it owns the polling
  // query that drives the unread dot. The popover's NotificationList reuses the
  // same cached query when it opens.
  const { data } = useNotifications(enabled);
  const unreadCount = data?.unreadCount ?? 0;

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
        className="relative grid size-9 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-foreground"
      >
        <Bell className="size-4.5" />
        {/* A single rose dot signals "unread" — the exact count lives in the
            popover header and the button's accessible name, so color stays
            reserved for meaning rather than carrying a number. */}
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 size-2 rounded-full bg-ros-dot ring-2 ring-[var(--sidebar)]"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-border bg-popover shadow-[var(--shadow-lg)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <NotificationList enabled={enabled} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
