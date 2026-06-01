import { cn } from "@/lib/utils";

/**
 * The single source of truth for a page's `<main>` wrapper — padding rhythm is
 * shared across every content page (matching the prototype's 44px top / 56px
 * side / 40px bottom desktop padding); only `width` differs per page.
 *
 * Use this for every routed page so the spacing can't drift. The login screen
 * is intentionally NOT a PageContainer (it owns a full-bleed centered layout).
 */
const MAX_WIDTHS = {
  form: "max-w-4xl", // narrow single-column forms (e.g. SLA policies)
  content: "max-w-6xl", // default reading width (stats, ticket detail, users)
  list: "max-w-7xl", // wide list pages (my tickets)
  dashboard: "max-w-[1320px]", // overview dashboard
  queue: "max-w-[1480px]", // the full ticket queue table
} as const;

export type PageWidth = keyof typeof MAX_WIDTHS;

interface Props {
  /** Content max-width token. Defaults to `content` (max-w-6xl). */
  width?: PageWidth;
  /** Extra classes merged onto `<main>` for the rare page-specific need. */
  className?: string;
  children: React.ReactNode;
}

export default function PageContainer({ width = "content", className, children }: Props) {
  return (
    <main
      className={cn(
        "mx-auto px-4 pt-11 pb-10 sm:px-6 md:px-8 md:pb-12 lg:px-12 xl:px-14",
        MAX_WIDTHS[width],
        className,
      )}
    >
      {children}
    </main>
  );
}
