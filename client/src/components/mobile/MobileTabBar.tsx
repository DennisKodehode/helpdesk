import { Inbox, LayoutDashboard, LineChart, UserCheck } from "lucide-react";
import { useLocation } from "react-router";
import { Link } from "@/components/ui/link";
import { useSession } from "@/lib/auth-client";
import { useMyOpenCount } from "@/lib/my-tickets";
import { isNavActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

// The phone build is agent-only: a fixed four-tab bar. No admin destinations.
const TABS = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/tickets", label: "Tickets", icon: Inbox },
  { to: "/my-tickets", label: "Mine", icon: UserCheck, badge: true },
  { to: "/my-stats", label: "Stats", icon: LineChart },
] as const;

export default function MobileTabBar() {
  const { pathname } = useLocation();
  const { data: session, isPending } = useSession();
  const { data: myOpenCount } = useMyOpenCount(!isPending && !!session);
  const badgeCount = myOpenCount?.count ?? 0;

  return (
    <nav
      aria-label="Primary"
      className="flex-none border-t border-border bg-background/[0.86] pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/[0.86]"
    >
      <div className="flex">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isNavActive(tab.to, pathname);
          const showBadge = "badge" in tab && tab.badge && badgeCount > 0;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 px-0 pt-2.5 pb-1.5 transition-colors",
                active ? "text-accent-ink" : "text-ink-4",
              )}
            >
              <span className="relative grid place-items-center">
                <Icon className="size-[22px]" />
                {showBadge && (
                  <span className="absolute -right-2.5 -top-1.5 inline-flex min-w-[15px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold text-primary-foreground leading-none">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10.5px] tracking-[0.01em]",
                  active ? "font-semibold" : "font-medium",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
