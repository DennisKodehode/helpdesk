import { Role } from "@helpdesk/core";
import { LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import { useSignOut } from "@/lib/use-sign-out";
import { cn } from "@/lib/utils";

/**
 * Account cluster at the foot of the tablet rail: an avatar button that opens a
 * popover with the theme toggle and sign out. No role switch — the role comes
 * from the real session, not a prototype toggle.
 */
export default function TabletAccountMenu() {
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const role = (session?.user as Record<string, unknown>)?.role;
  const name = session?.user.name ?? "";
  const email = session?.user.email ?? "";
  const initial = (name || email).trim().charAt(0).toUpperCase();

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

  async function handleSignOut() {
    setOpen(false);
    await signOut();
  }

  return (
    <div ref={ref} className="relative flex justify-center">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "grid size-10 place-items-center rounded-full border bg-panel-2 text-[14px] font-semibold text-ink-2 transition-colors",
          open ? "border-primary" : "border-border hover:border-hairline-strong",
        )}
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-0 left-[calc(100%+12px)] z-50 w-56 overflow-hidden rounded-md border border-border bg-popover shadow-[var(--shadow-lg)]"
        >
          <div className="border-b border-border px-3.5 py-3">
            <p className="truncate text-[14px] font-medium text-foreground leading-tight">
              {name || "Account"}
            </p>
            <p className="truncate font-mono text-[11px] text-ink-3 leading-tight mt-0.5">
              {role === Role.admin ? "Admin" : "Agent"}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              toggleTheme();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-3 text-[14px] text-foreground hover:bg-panel-2 transition-colors"
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
            className="flex w-full items-center gap-2.5 px-3.5 py-3 text-[14px] text-foreground hover:bg-panel-2 transition-colors"
          >
            <LogOut className="size-4 text-muted-foreground" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
