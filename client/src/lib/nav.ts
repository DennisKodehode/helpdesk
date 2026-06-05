import {
  Activity,
  BookText,
  Inbox,
  LayoutDashboard,
  LineChart,
  RotateCcw,
  UserCheck,
  Users,
} from "lucide-react";

/**
 * Navigation is defined once here and consumed by every nav chrome — the
 * desktop sidebar and the tablet icon rail — so the two never drift. The mobile
 * bottom tab bar is intentionally agent-only and defines its own subset.
 */
export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Shown to every signed-in user. */
export const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tickets", label: "Tickets", icon: Inbox },
];

/** Shown only to agents (admins don't have a personal queue). */
export const AGENT_NAV: NavItem[] = [
  { to: "/my-tickets", label: "My tickets", icon: UserCheck },
  { to: "/my-stats", label: "My stats", icon: LineChart },
];

/** Administration section — admins only. */
export const ADMIN_NAV: NavItem[] = [
  { to: "/users", label: "Agents", icon: Users },
  { to: "/workflow", label: "Workflow", icon: RotateCcw },
  { to: "/knowledge-base", label: "Knowledge base", icon: BookText },
  { to: "/activity", label: "Activity", icon: Activity },
];

/** Active-route test shared by sidebar + rail (exact match for "/"). */
export function isNavActive(path: string, current: string): boolean {
  if (path === "/") return current === "/";
  return current.startsWith(path);
}
