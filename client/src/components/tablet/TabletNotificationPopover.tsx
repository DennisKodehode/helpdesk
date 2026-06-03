import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import NotificationList from "../NotificationList";

/**
 * Rail-anchored notification bell: the same trigger styling as a rail item, with
 * the shared NotificationList opening in a popover to the right of the rail.
 */
export default function TabletNotificationPopover() {
  const { data: session, isPending } = useSession();
  const enabled = !isPending && !!session;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useNotifications(enabled);
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
    <div ref={ref} className="relative mb-1.5 flex justify-center">
      <button
        type="button"
        aria-label={
          unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid size-12 place-items-center rounded-[14px] transition-colors",
          open
            ? "bg-panel text-accent-ink shadow-[var(--shadow-sm)]"
            : "text-ink-3 hover:bg-panel-2 hover:text-foreground",
        )}
      >
        <Bell className="size-[21px]" />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute right-2.5 top-2.5 size-2 rounded-full bg-ros-dot ring-2 ring-[var(--sidebar)]"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-0 left-[calc(100%+12px)] z-50 w-80 overflow-hidden rounded-md border border-border bg-popover shadow-[var(--shadow-lg)]"
        >
          <NotificationList enabled={enabled} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
