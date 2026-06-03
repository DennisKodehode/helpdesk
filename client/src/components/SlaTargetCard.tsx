import { AT_RISK_THRESHOLD, type TicketPriority } from "@helpdesk/core";
import SlaDurationField from "@/components/SlaDurationField";
import { PRIORITY_DOT, PRIORITY_LABELS } from "@/lib/ticket-ui";

const META: Record<TicketPriority, string> = {
  urgent: "Page-worthy. The customer is blocked.",
  high: "Significant impact — needs a same-day touch.",
  normal: "The default for most inbound tickets.",
  low: "Questions and nice-to-haves.",
};

// Friendly duration for the "at risk at X" caption.
function fmtDur(m: number | null): string {
  if (m == null) return "No target";
  if (m % 1440 === 0) return `${m / 1440} ${m / 1440 === 1 ? "day" : "days"}`;
  if (m % 60 === 0) return `${m / 60} ${m / 60 === 1 ? "hour" : "hours"}`;
  if (m > 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m} min`;
}

export interface EditablePolicy {
  priority: TicketPriority;
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
}

type Which = "firstResponseMinutes" | "resolutionMinutes";

interface Props {
  policy: EditablePolicy;
  onChange: (priority: TicketPriority, which: Which, value: number | null) => void;
}

export default function SlaTargetCard({ policy, onChange }: Props) {
  const { priority } = policy;

  function Editor({
    which,
    label,
    allowNone,
  }: {
    which: Which;
    label: string;
    allowNone?: boolean;
  }) {
    const m = policy[which];
    const atRisk = m == null ? null : Math.round(m * AT_RISK_THRESHOLD);
    return (
      <div className="min-w-[220px] flex-1">
        <p className="eyebrow mb-2.5">{label}</p>
        <SlaDurationField
          minutes={m}
          allowNone={allowNone}
          label={`${PRIORITY_LABELS[priority]} ${label}`}
          onChange={(v) => onChange(priority, which, v)}
        />
        <p className="mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.05em] text-ink-4">
          {m == null ? "not tracked" : `at risk at ${fmtDur(atRisk)}`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-7 rounded-[var(--r-lg)] border border-border bg-card px-[26px] py-[22px]">
      <div className="w-[188px] shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`size-2.5 rounded-full ${PRIORITY_DOT[priority]}`}
          />
          <span className="display-serif text-[23px] leading-tight text-foreground">
            {PRIORITY_LABELS[priority]}
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">{META[priority]}</p>
      </div>
      {/* @container so the divider can hide when the two editors wrap to a
          stack — a vertical w-px rule between stacked editors orphans into a
          stray line. */}
      <div className="@container/sla flex min-w-[280px] flex-1 flex-wrap gap-7">
        <Editor which="firstResponseMinutes" label="First response" />
        <div
          aria-hidden
          className="hidden w-px self-stretch bg-border @min-[32rem]/sla:block"
        />
        <Editor which="resolutionMinutes" label="Resolution" allowNone />
      </div>
    </div>
  );
}
