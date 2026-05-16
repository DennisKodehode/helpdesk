import { TicketStatus, TicketCategory, TicketPriority, TRIAGING_STATUSES } from "@helpdesk/core";

export function isTriagingStatus(status: TicketStatus): boolean {
  return (TRIAGING_STATUSES as TicketStatus[]).includes(status);
}

export const TRIAGING_LABEL = "Triaging";
export const TRIAGING_STYLE =
  "bg-violet-500/8 text-violet-700 border-violet-500/20 dark:text-violet-300 dark:bg-violet-400/10 dark:border-violet-400/20";
export const TRIAGING_DOT = "bg-violet-500";

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

// Priority: only the attention-grabbing levels get a colored pill;
// normal/low stay neutral so the queue doesn't look like a Christmas tree.
export const PRIORITY_STYLES: Record<TicketPriority, string> = {
  [TicketPriority.low]:
    "bg-transparent text-muted-foreground/70 border-border",
  [TicketPriority.normal]:
    "bg-transparent text-muted-foreground border-border",
  [TicketPriority.high]:
    "bg-orange-500/8 text-orange-700 border-orange-500/20 dark:text-orange-300 dark:bg-orange-400/10 dark:border-orange-400/20",
  [TicketPriority.urgent]:
    "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300 dark:bg-rose-400/12 dark:border-rose-400/25",
};

export const PRIORITY_DOT: Record<TicketPriority, string> = {
  [TicketPriority.low]: "bg-zinc-300 dark:bg-zinc-600",
  [TicketPriority.normal]: "bg-zinc-400 dark:bg-zinc-500",
  [TicketPriority.high]: "bg-orange-500",
  [TicketPriority.urgent]: "bg-rose-500",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.low]: "Low",
  [TicketPriority.normal]: "Normal",
  [TicketPriority.high]: "High",
  [TicketPriority.urgent]: "Urgent",
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
