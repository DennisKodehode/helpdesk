import { Bell } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";
import { Link } from "@/components/ui/link";
import { useSession } from "@/lib/auth-client";
import { useNotifications } from "@/lib/notifications";
import MobileNotificationSheet from "./MobileNotificationSheet";
import MobileTabBar from "./MobileTabBar";

// Routes that live under the tabbed shell (brand bar + bottom tabs). Anything
// else (e.g. /tickets/:id) is a full-screen detail view that brings its own
// chrome, so the shell steps out of the way.
const TAB_ROUTES = new Set(["/", "/tickets", "/my-tickets", "/my-stats"]);

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { data: session, isPending } = useSession();
  const [notifOpen, setNotifOpen] = useState(false);
  const { data } = useNotifications(!isPending && !!session);
  const unreadCount = data?.unreadCount ?? 0;

  const tabbed = TAB_ROUTES.has(pathname);

  // Detail routes render full-screen with their own back navigation.
  if (!tabbed) {
    return <div className="flex h-dvh flex-col bg-background">{children}</div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex-none border-b border-border bg-background/[0.86] pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/[0.86]">
        <div className="flex h-[52px] items-center justify-between px-4">
          <Link to="/" className="group inline-flex items-baseline">
            <span className="display-serif text-[21px] leading-none text-foreground transition-opacity duration-200 group-hover:opacity-85">
              Helpdesk
            </span>
            <span
              aria-hidden
              className="display-serif italic text-[21px] leading-none text-primary"
            >
              .
            </span>
          </Link>
          <button
            type="button"
            aria-label={
              unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"
            }
            onClick={() => setNotifOpen(true)}
            className="relative grid size-10 place-items-center rounded-md text-ink-2 transition-colors hover:bg-panel-2"
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 size-[7px] rounded-full bg-ros-dot ring-2 ring-background"
              />
            )}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

      <MobileTabBar />
      <MobileNotificationSheet open={notifOpen} onOpenChange={setNotifOpen} />
    </div>
  );
}
