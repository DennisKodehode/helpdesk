import { Menu } from "lucide-react";
import { Link } from "@/components/ui/link";
import NotificationBell from "./NotificationBell";

interface Props {
  onMenuClick: () => void;
}

export default function MobileTopbar({ onMenuClick }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/85 px-3 supports-backdrop-filter:backdrop-blur md:hidden">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenuClick}
        className="-ml-1 grid size-11 place-items-center rounded-md text-foreground transition-colors hover:bg-panel-2"
      >
        <Menu className="size-5" />
      </button>
      <Link to="/" className="group inline-flex items-baseline">
        <span className="display-serif text-[22px] leading-none text-foreground transition-opacity duration-200 group-hover:opacity-85">
          Helpdesk
        </span>
        <span
          aria-hidden
          className="display-serif italic text-[22px] leading-none text-primary transition-transform duration-200 group-hover:translate-y-px"
        >
          .
        </span>
      </Link>
      <NotificationBell />
    </header>
  );
}
