import {
  SlaMetric,
  type SlaState,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TRIAGING_STATUSES,
} from "@helpdesk/core";

export function isTriagingStatus(status: TicketStatus): boolean {
  return (TRIAGING_STATUSES as TicketStatus[]).includes(status);
}

export const TRIAGING_LABEL = "Triaging";
// Triaging (new + processing) shares the violet "AI" tone — the machine is
// still working the ticket. Tone vars redefine under .dark, so no `dark:`.
export const TRIAGING_STYLE = "bg-vio-bg text-vio-fg border-vio-dot/30";
export const TRIAGING_DOT = "bg-vio-dot";

// Restrained pill: hairline border, soft tint, small-caps mono label.
export const BADGE_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10.5px] font-mono font-medium uppercase tracking-[0.07em]";

// A small color dot prefix — the pill itself stays calm.
export const STATUS_DOT: Record<TicketStatus, string> = {
  [TicketStatus.new]: "bg-sky-dot",
  [TicketStatus.processing]: "bg-vio-dot",
  [TicketStatus.open]: "bg-amb-dot",
  [TicketStatus.resolved]: "bg-eme-dot",
  [TicketStatus.closed]: "bg-zin-dot",
};

// Pill styling: subtle tinted background, restrained text. One look across
// statuses, sourced from the semantic tone triplets (auto dark-adapting).
export const STATUS_STYLES: Record<TicketStatus, string> = {
  [TicketStatus.new]: "bg-sky-bg text-sky-fg border-sky-dot/30",
  [TicketStatus.processing]: "bg-vio-bg text-vio-fg border-vio-dot/30",
  [TicketStatus.open]: "bg-amb-bg text-amb-fg border-amb-dot/30",
  [TicketStatus.resolved]: "bg-eme-bg text-eme-fg border-eme-dot/30",
  [TicketStatus.closed]: "bg-zin-bg text-zin-fg border-zin-dot/30",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.new]: "New",
  [TicketStatus.processing]: "Processing",
  [TicketStatus.open]: "Open",
  [TicketStatus.resolved]: "Resolved",
  [TicketStatus.closed]: "Closed",
};

// Categories: no color tint, just a neutral pill — these are taxonomy, not state.
export const CATEGORY_BADGE = "bg-transparent text-ink-2 border-hairline-strong";

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
  // Low/normal carry no pill chrome (border-transparent) — they read as plain
  // muted mono text so the queue doesn't light up like a Christmas tree.
  [TicketPriority.low]: "bg-transparent text-ink-4 border-transparent",
  [TicketPriority.normal]: "bg-transparent text-ink-3 border-transparent",
  [TicketPriority.high]: "bg-org-bg text-org-fg border-org-dot/30",
  [TicketPriority.urgent]: "bg-ros-bg text-ros-fg border-ros-dot/35",
};

export const PRIORITY_DOT: Record<TicketPriority, string> = {
  [TicketPriority.low]: "bg-zin-dot/60",
  [TicketPriority.normal]: "bg-zin-dot",
  [TicketPriority.high]: "bg-org-dot",
  [TicketPriority.urgent]: "bg-ros-dot",
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

// SLA badge: 'ok' renders nothing (no chrome on healthy tickets); 'at_risk'
// fires at >=75% of the target window elapsed (purely visual, no server
// notification); 'breached' once the window has elapsed.
export const SLA_STYLES: Record<Exclude<SlaState, "ok">, string> = {
  at_risk: "bg-amb-bg text-amb-fg border-amb-dot/30",
  breached: "bg-ros-bg text-ros-fg border-ros-dot/35",
};

export const SLA_DOT: Record<Exclude<SlaState, "ok">, string> = {
  at_risk: "bg-amb-dot",
  breached: "bg-ros-dot",
};

export const SLA_LABELS: Record<Exclude<SlaState, "ok">, string> = {
  at_risk: "At risk",
  breached: "Breached",
};

export const SLA_METRIC_LABELS: Record<SlaMetric, string> = {
  [SlaMetric.first_response]: "First-response SLA",
  [SlaMetric.resolution]: "Resolution SLA",
};

// Human-readable duration: "30m", "1h 20m", "2d 4h". Used in the badge
// tooltip — formatRelative is "ago"-shaped and doesn't fit here.
export function formatDurationShort(totalMinutes: number): string {
  const abs = Math.abs(Math.round(totalMinutes));
  if (abs < 60) return `${abs}m`;
  const days = Math.floor(abs / (24 * 60));
  const hours = Math.floor((abs - days * 24 * 60) / 60);
  const minutes = abs - days * 24 * 60 - hours * 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}
