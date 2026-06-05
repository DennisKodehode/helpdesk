import { hasAdminAccess, Role } from "@helpdesk/core";
import { useLocation } from "react-router";
import { Link } from "@/components/ui/link";
import { useSession } from "@/lib/auth-client";
import { useMyOpenCount } from "@/lib/my-tickets";
import { ADMIN_NAV, AGENT_NAV, isNavActive, PRIMARY_NAV } from "@/lib/nav";
import TabletAccountMenu from "./TabletAccountMenu";
import TabletNotificationPopover from "./TabletNotificationPopover";
import TabletRailItem from "./TabletRailItem";

/**
 * The 76px collapsed nav rail for the tablet tier — same nav config as the
 * desktop sidebar (the shared `lib/nav`), only icon-only with tooltips. Admin
 * items appear below a divider; the bottom holds the notification popover and
 * the account cluster.
 */
export default function TabletIconRail() {
  const { pathname } = useLocation();
  const { data: session, isPending } = useSession();
  const role = (session?.user as Record<string, unknown>)?.role;
  const isAgent = !isPending && role === Role.agent;
  const isAdmin = !isPending && hasAdminAccess(role as string | undefined);
  const { data: myOpenCount } = useMyOpenCount(isAgent);

  const primary = [...PRIMARY_NAV, ...(isAgent ? AGENT_NAV : [])];

  return (
    <aside className="relative z-20 flex h-full w-[76px] flex-none flex-col items-center border-r border-border bg-sidebar py-4">
      <Link
        to="/"
        aria-label="Helpdesk"
        className="group mb-[18px] inline-flex items-baseline leading-none"
      >
        <span className="display-serif text-[26px] leading-none text-foreground transition-opacity duration-200 group-hover:opacity-85">
          H
        </span>
        <span
          aria-hidden
          className="display-serif italic text-[26px] leading-none text-primary transition-transform duration-200 group-hover:translate-y-px"
        >
          .
        </span>
      </Link>

      <nav className="flex w-full flex-1 flex-col items-center gap-1.5">
        {primary.map((item) => (
          <TabletRailItem
            key={item.to}
            item={item}
            active={isNavActive(item.to, pathname)}
            badge={item.to === "/my-tickets" ? myOpenCount?.count : undefined}
          />
        ))}
        {isAdmin && (
          <>
            <span aria-hidden className="my-2 h-px w-7 bg-border" />
            {ADMIN_NAV.map((item) => (
              <TabletRailItem
                key={item.to}
                item={item}
                active={isNavActive(item.to, pathname)}
              />
            ))}
          </>
        )}
      </nav>

      <TabletNotificationPopover />
      <TabletAccountMenu />
    </aside>
  );
}
