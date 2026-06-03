import { Link } from "@/components/ui/link";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

interface Props {
  item: NavItem;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}

/**
 * A single 48px nav target in the tablet icon rail: icon-only with an
 * accessible label, a left accent bar when active, an optional count badge, and
 * a hover/focus tooltip (CSS-driven via the parent `group`).
 */
export default function TabletRailItem({ item, active, badge, onNavigate }: Props) {
  const Icon = item.icon;
  const showBadge = typeof badge === "number" && badge > 0;
  return (
    <div className="group relative flex justify-center">
      <Link
        to={item.to}
        onClick={onNavigate}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative grid size-12 place-items-center rounded-[14px] transition-colors",
          active
            ? "bg-panel text-accent-ink shadow-[var(--shadow-sm)]"
            : "text-ink-3 hover:bg-panel-2 hover:text-foreground",
        )}
      >
        <Icon className="size-[21px]" />
        {showBadge && (
          <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9.5px] font-semibold text-primary-foreground tabular leading-4">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
      {/* Active accent bar — grows in from zero height. */}
      <span
        aria-hidden
        className={cn(
          "absolute -left-0.5 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all",
          active ? "h-[22px] opacity-100" : "h-0 opacity-0",
        )}
      />
      {/* Tooltip — decorative (the link already carries the accessible name), so
          aria-hidden to avoid a double announcement. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-[12.5px] font-semibold text-background opacity-0 shadow-[var(--shadow-lg)] transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
      >
        {item.label}
      </span>
    </div>
  );
}
