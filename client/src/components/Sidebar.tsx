import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "../lib/auth-client";
import { Role } from "@helpdesk/core";
import { useTheme } from "@/lib/theme";
import {
  LayoutDashboard,
  Inbox,
  Users,
  UserCheck,
  LineChart,
  LogOut,
  Sun,
  Moon,
  ChevronsUpDown,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import { useMyOpenCount } from "@/lib/my-tickets";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function isActive(path: string, current: string): boolean {
  if (path === "/") return current === "/";
  return current.startsWith(path);
}

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
        "group relative flex items-center gap-3 rounded-md px-3 py-3 text-[15px] transition-colors md:px-2.5 md:py-1.5 md:text-[13px]",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute -left-3 top-1/2 h-4 w-px -translate-y-1/2 transition-all",
          active ? "bg-primary" : "bg-transparent"
        )}
      />
      <Icon className={cn("size-5 shrink-0 md:size-4", active ? "text-foreground" : "text-muted-foreground/70")} />
      <span className="leading-none">{item.label}</span>
      {showBadge && (
        <span
          aria-label={`${badge} open`}
          className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary/10 px-1.5 font-mono text-[10px] font-medium text-primary tabular leading-5 md:text-[10px]"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function SidebarContents({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
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
    navigate("/login", { replace: true });
  }

  const primaryNav: NavItem[] = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/tickets", label: "Tickets", icon: Inbox },
  ];

  const isAgent = !isPending && role === Role.agent;
  const myTicketsItem: NavItem = { to: "/my-tickets", label: "My tickets", icon: UserCheck };
  const myStatsItem: NavItem = { to: "/my-stats", label: "My stats", icon: LineChart };
  const { data: myOpenCount } = useMyOpenCount(isAgent);

  const adminNav: NavItem[] = [{ to: "/users", label: "Agents", icon: Users }];

  return (
    <>
      <div className="flex h-16 items-center justify-between px-5 md:h-14">
        <Link to="/" onClick={onNavigate} className="group inline-flex items-baseline gap-1.5">
          <span className="display-serif text-[26px] leading-none text-foreground md:text-[22px]">
            Helpdesk
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 leading-none md:text-[10px]">
            v1
          </span>
        </Link>
        <NotificationBell align="start" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-3 pb-4 md:pt-2">
        <div className="px-3 pb-2 md:px-2.5 md:pb-1.5">
          <p className="eyebrow text-[11px] md:text-[10px]">Workspace</p>
        </div>
        <ul className="space-y-1 md:space-y-0.5">
          {primaryNav.map((item) => (
            <li key={item.to}>
              <SidebarLink item={item} active={isActive(item.to, pathname)} onNavigate={onNavigate} />
            </li>
          ))}
          {isAgent && (
            <>
              <li>
                <SidebarLink
                  item={myTicketsItem}
                  active={isActive(myTicketsItem.to, pathname)}
                  onNavigate={onNavigate}
                  badge={myOpenCount?.count}
                />
              </li>
              <li>
                <SidebarLink
                  item={myStatsItem}
                  active={isActive(myStatsItem.to, pathname)}
                  onNavigate={onNavigate}
                />
              </li>
            </>
          )}
        </ul>

        {!isPending && role === Role.admin && (
          <>
            <div className="px-3 pt-7 pb-2 md:px-2.5 md:pt-6 md:pb-1.5">
              <p className="eyebrow text-[11px] md:text-[10px]">Administration</p>
            </div>
            <ul className="space-y-1 md:space-y-0.5">
              {adminNav.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} active={isActive(item.to, pathname)} onNavigate={onNavigate} />
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
            className="absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-md border border-border bg-popover shadow-[0_8px_30px_-12px_rgb(0_0_0_/_0.18)]"
          >
            <button
              role="menuitem"
              onClick={toggleTheme}
              className="flex w-full items-center gap-2.5 px-3 py-3 text-[14px] text-foreground hover:bg-accent transition-colors md:py-2 md:text-[13px]"
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
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-3 py-3 text-[14px] text-foreground hover:bg-accent transition-colors md:py-2 md:text-[13px]"
            >
              <LogOut className="size-4 text-muted-foreground" />
              Sign out
            </button>
          </div>
        )}

        <button
          aria-label="Account menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent/60 md:py-2"
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-medium text-primary md:size-8 md:text-[12px]">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-foreground leading-tight md:text-[13px]">
              {name || "Account"}
            </p>
            <p className="truncate font-mono text-[11px] text-muted-foreground leading-tight mt-0.5 md:text-[10px]">
              {role === Role.admin ? "Admin" : "Agent"}
            </p>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground/60 md:size-3.5" />
        </button>
      </div>
    </>
  );
}

interface Props {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, onMobileOpenChange }: Props) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar md:flex xl:w-64 2xl:w-72">
        <SidebarContents />
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-foreground/40 duration-150 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 motion-reduce:animate-none md:hidden" />
          <DialogPrimitive.Popup
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-sidebar shadow-2xl outline-none duration-200 data-open:animate-in data-open:slide-in-from-left motion-reduce:animate-none md:hidden"
          >
            <DialogPrimitive.Title className="sr-only">
              Navigation
            </DialogPrimitive.Title>
            <SidebarContents onNavigate={() => onMobileOpenChange(false)} />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
