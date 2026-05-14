import { TicketStatus, TicketCategory } from "@helpdesk/core";

// Restrained pill: hairline border, soft tint, small caps mono label.
export const BADGE_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-mono font-medium uppercase tracking-[0.08em]";

// A small color dot prefix — the pill itself stays calm.
export const STATUS_DOT: Record<TicketStatus, string> = {
  [TicketStatus.new]: "bg-sky-500",
  [TicketStatus.processing]: "bg-violet-500",
  [TicketStatus.open]: "bg-amber-500",
  [TicketStatus.resolved]: "bg-emerald-500",
  [TicketStatus.closed]: "bg-zinc-400 dark:bg-zinc-500",
};

// Pill styling: subtle tinted background, restrained text. One look across statuses.
export const STATUS_STYLES: Record<TicketStatus, string> = {
  [TicketStatus.new]:
    "bg-sky-500/8 text-sky-700 border-sky-500/20 dark:text-sky-300 dark:bg-sky-400/10 dark:border-sky-400/20",
  [TicketStatus.processing]:
    "bg-violet-500/8 text-violet-700 border-violet-500/20 dark:text-violet-300 dark:bg-violet-400/10 dark:border-violet-400/20",
  [TicketStatus.open]:
    "bg-amber-500/8 text-amber-700 border-amber-500/20 dark:text-amber-300 dark:bg-amber-400/10 dark:border-amber-400/20",
  [TicketStatus.resolved]:
    "bg-emerald-500/8 text-emerald-700 border-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-400/10 dark:border-emerald-400/20",
  [TicketStatus.closed]:
    "bg-muted text-muted-foreground border-border",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.new]: "New",
  [TicketStatus.processing]: "Processing",
  [TicketStatus.open]: "Open",
  [TicketStatus.resolved]: "Resolved",
  [TicketStatus.closed]: "Closed",
};

// Categories: no color tint, just a neutral pill — these are taxonomy, not state.
export const CATEGORY_BADGE =
  "bg-transparent text-muted-foreground border-border";

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  [TicketCategory.general_question]: "General",
  [TicketCategory.technical_question]: "Technical",
  [TicketCategory.refund_request]: "Refund",
  [TicketCategory.billing_inquiry]: "Billing",
  [TicketCategory.feature_request]: "Feature",
};

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((now - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 14) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
