import { Menu } from "lucide-react";
import { Link } from "@/components/ui/link";

interface Props {
  onMenuClick: () => void;
}

export default function MobileTopbar({ onMenuClick }: Props) {
  return (
    <header
      aria-label="Mobile header"
      className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/85 px-3 supports-backdrop-filter:backdrop-blur md:hidden"
    >
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenuClick}
        className="-ml-1 grid size-11 place-items-center rounded-md text-foreground transition-colors hover:bg-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Menu className="size-5" />
      </button>
      <Link to="/" className="inline-flex items-baseline gap-1.5">
        <span className="display-serif text-[22px] leading-none text-foreground">
          Helpdesk
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
          v1
        </span>
      </Link>
      <span aria-hidden className="size-11" />
    </header>
  );
}
