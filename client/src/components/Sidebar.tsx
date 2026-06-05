import { hasAdminAccess, Role } from "@helpdesk/core";
import { ChevronsUpDown, LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { Link } from "@/components/ui/link";
import { useMyOpenCount } from "@/lib/my-tickets";
import {
  ADMIN_NAV,
  AGENT_NAV,
  isNavActive as isActive,
  type NavItem,
  PRIMARY_NAV,
} from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import { ROLE_LABEL } from "@/lib/ticket-ui";
import { useSignOut } from "@/lib/use-sign-out";
import { cn } from "@/lib/utils";
import { useSession } from "../lib/auth-client";
import NotificationBell from "./NotificationBell";

function SidebarLink({
  item,
  active,
  onNavigate,
  badge,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  badge?: number;
}) {
  const Icon = item.icon;
  const showBadge = typeof badge === "number" && badge > 0;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] transition-colors",
        active
          ? "bg-panel font-semibold text-foreground shadow-[var(--shadow-sm)]"
          : "text-ink-3 hover:bg-panel-2 hover:text-foreground",
      )}
    >
      {/* The 3px violet rail is the active indicator — it grows in from zero
          height so a click lands with a small, quiet motion. */}
      <span
        aria-hidden
        className={cn(
          "absolute -left-2.5 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all",
          active ? "h-[18px] opacity-100" : "h-0 opacity-0",
        )}
      />
      <Icon
        className={cn("size-5 shrink-0", active ? "text-accent-ink" : "text-ink-3")}
      />
      <span className="leading-none">{item.label}</span>
      {showBadge && (
        <span
          role="status"
          aria-label={`${badge} open`}
          className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent-tint-2 px-1.5 font-mono text-[10px] font-medium text-accent-ink tabular leading-5"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function SidebarContents({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { data: session, isPending } = useSession();
  const signOut = useSignOut();
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();

  const role = (session?.user as Record<string, unknown>)?.role;
  const name = session?.user.name ?? "";
  const email = session?.user.email ?? "";
  const initial = (name || email).trim().charAt(0).toUpperCase();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
  }

  const isAgent = !isPending && role === Role.agent;
  const { data: myOpenCount } = useMyOpenCount(isAgent);

  // The badge (open-ticket count) only belongs on "My tickets".
  const badgeFor = (item: NavItem) =>
    item.to === "/my-tickets" ? myOpenCount?.count : undefined;

  return (
    <>
      <div className="flex h-[68px] items-center justify-between pr-[18px] pl-[22px]">
        <Link to="/" onClick={onNavigate} className="group inline-flex items-baseline">
          <span className="display-serif text-[26px] leading-none text-foreground transition-opacity duration-200 group-hover:opacity-85">
            Helpdesk
          </span>
          {/* The italic period is the wordmark's voice — mirrors the
              "AI-powered ticket management." italic accent on the login page.
              Drops down a hair on hover so the logo has a tiny pulse without
              being a full-blown animation. */}
          <span
            aria-hidden
            className="display-serif italic text-[26px] leading-none text-primary transition-transform duration-200 group-hover:translate-y-px"
          >
            .
          </span>
        </Link>
        <NotificationBell align="start" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
        <div className="hairline-b px-3 pb-2 mb-2">
          <p className="eyebrow">Workspace</p>
        </div>
        <ul className="space-y-1">
          {[...PRIMARY_NAV, ...(isAgent ? AGENT_NAV : [])].map((item) => (
            <li key={item.to}>
              <SidebarLink
                item={item}
                active={isActive(item.to, pathname)}
                onNavigate={onNavigate}
                badge={badgeFor(item)}
              />
            </li>
          ))}
        </ul>

        {!isPending && hasAdminAccess(role as string | undefined) && (
          <>
            <div className="hairline-b px-3 pt-7 pb-2 mb-2">
              <p className="eyebrow">Administration</p>
            </div>
            <ul className="space-y-1">
              {ADMIN_NAV.map((item) => (
                <li key={item.to}>
                  <SidebarLink
                    item={item}
                    active={isActive(item.to, pathname)}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      <div ref={menuRef} className="relative border-t border-border p-2">
        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-md border border-border bg-popover shadow-[var(--shadow-lg)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={toggleTheme}
              className="flex w-full items-center gap-2.5 px-3 py-3 text-[14px] text-foreground hover:bg-panel-2 transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="size-4 text-muted-foreground" />
              ) : (
                <Moon className="size-4 text-muted-foreground" />
              )}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <div className="hairline-t" />
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-3 py-3 text-[14px] text-foreground hover:bg-panel-2 transition-colors"
            >
              <LogOut className="size-4 text-muted-foreground" />
              Sign out
            </button>
          </div>
        )}

        <button
          type="button"
          aria-label="Account menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-panel-2"
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-panel-2 text-[13px] font-semibold text-ink-2">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-foreground leading-tight">
              {name || "Account"}
            </p>
            <p className="truncate font-mono text-[11px] text-ink-3 leading-tight mt-0.5">
              {ROLE_LABEL[role as Role] ?? "Agent"}
            </p>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-4" />
        </button>
      </div>
    </>
  );
}

// Desktop-only nav. The tablet tier uses TabletIconRail and the mobile tier
// uses MobileShell, so this is rendered solely inside DesktopShell (>=1280px).
export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-sidebar">
      <SidebarContents />
    </aside>
  );
}
