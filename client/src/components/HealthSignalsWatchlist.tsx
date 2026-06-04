import type { AuditEventType, HealthSignal } from "@helpdesk/core";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import ErrorAlert from "@/components/ui/ErrorAlert";
import Sparkline from "@/components/ui/Sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SIGNAL_META,
  STATE_LABEL,
  STATE_ORDER,
  STATE_TONE,
  useHealthSignals,
} from "@/lib/health-signals";
import { cn } from "@/lib/utils";

type Tone = "ros" | "amb" | "eme";

// Tailwind needs literal class names, so map tones explicitly.
const DOT_BG: Record<Tone, string> = {
  ros: "bg-ros-dot",
  amb: "bg-amb-dot",
  eme: "bg-eme-dot",
};
const FG_TEXT: Record<Tone, string> = {
  ros: "text-ros-fg",
  amb: "text-amb-fg",
  eme: "text-eme-fg",
};

const CARD = "overflow-hidden rounded-[var(--r-lg)] border border-border bg-card";
const ROW_COLS = "grid-cols-[3px_minmax(0,1fr)_152px_130px]";

interface Props {
  /** Current activity-log type filter — highlights the matching row. */
  currentType: string;
  /** Clicking a row filters the activity log to the signal's event type. */
  onDrill: (type: AuditEventType) => void;
}

function StateTag({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] font-mono text-[10px] font-medium uppercase tracking-[0.1em]",
        FG_TEXT[tone],
      )}
    >
      <span
        aria-hidden
        className={cn("size-[7px] flex-none rounded-full", DOT_BG[tone])}
      />
      {label}
    </span>
  );
}

function DeltaChip({ signal }: { signal: HealthSignal }) {
  const { unit, worseDir } = SIGNAL_META[signal.id];
  const dir = signal.delta > 0 ? "up" : signal.delta < 0 ? "down" : "flat";
  const color =
    dir === "flat"
      ? "text-ink-4"
      : dir === worseDir
        ? "text-ros-fg" // a worsening move
        : "text-eme-fg"; // an improving move
  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus;
  const magnitude = Math.abs(signal.delta);
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-[11px]", color)}>
      <Icon aria-hidden className="size-3" />
      {unit === "%" ? `${magnitude} pts` : magnitude}
    </span>
  );
}

function SignalValue({ signal }: { signal: HealthSignal }) {
  const { unit } = SIGNAL_META[signal.id];
  return (
    <span className="flex items-baseline gap-1">
      {/* Newsreader thins at large sizes in dark mode — bump weight to keep it legible. */}
      <span className="display-serif tabular text-[38px] leading-none text-foreground dark:font-semibold">
        {signal.value}
      </span>
      {unit && (
        <span className="display-serif text-[16px] leading-none text-ink-4">{unit}</span>
      )}
    </span>
  );
}

function SignalRow({
  signal,
  active,
  onDrill,
}: {
  signal: HealthSignal;
  active: boolean;
  onDrill: (type: AuditEventType) => void;
}) {
  const meta = SIGNAL_META[signal.id];
  const tone = STATE_TONE[signal.state];
  // State-aware diagnostic line: muted when there's too little data, the likely
  // cause when something's off, a reassuring read when healthy.
  const read = signal.lowSample
    ? `Only ${signal.denominator} in the last 7 days — not enough to read yet.`
    : signal.state === "ok"
      ? meta.healthy
      : meta.concern;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${meta.label}: ${signal.value}${meta.unit} — ${STATE_LABEL[signal.state]}. Filter the activity log.`}
      onClick={() => onDrill(meta.drillType)}
      className={cn(
        "grid w-full items-stretch border-t border-border text-left transition-colors first:border-t-0",
        ROW_COLS,
        "hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
        active && "bg-panel-2",
      )}
    >
      {/* Col 1 — severity accent bar */}
      <span aria-hidden className={cn("rounded-[1px]", DOT_BG[tone])} />

      {/* Col 2 — state + label + read */}
      <span className="flex min-w-0 flex-col justify-center px-6 py-4">
        <StateTag tone={tone} label={STATE_LABEL[signal.state]} />
        <span className="mt-1.5 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          {meta.label}
        </span>
        <span className="mt-[3px] text-[12.5px] leading-relaxed text-ink-2 [text-wrap:pretty]">
          {read}
        </span>
      </span>

      {/* Col 3 — trend */}
      <span className="flex flex-col items-start justify-center gap-1.5 py-4">
        <Sparkline data={signal.spark} tone={tone} />
        <span className="font-mono text-[9.5px] text-ink-4">
          {meta.formatSub(signal)}
        </span>
      </span>

      {/* Col 4 — value + delta */}
      <span className="flex flex-col items-end justify-center gap-1.5 py-4 pr-6 pl-2">
        <SignalValue signal={signal} />
        <DeltaChip signal={signal} />
      </span>
    </button>
  );
}

function Header() {
  return (
    <div className="mb-3.5 flex items-baseline justify-between">
      <span className="eyebrow">Signals · watchlist</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-4">
        Last 7 days
      </span>
    </div>
  );
}

export default function HealthSignalsWatchlist({ currentType, onDrill }: Props) {
  const { data, isPending, isError } = useHealthSignals();

  if (isError) {
    return (
      <div className="mb-6">
        <Header />
        <ErrorAlert message="Failed to load health signals" />
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mb-6">
        <Header />
        <div className={CARD} role="status" aria-label="Loading health signals">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
            <div key={i} className="border-t border-border px-6 py-5 first:border-t-0">
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.signals.length === 0) return null;

  // Severity-sorted: alerts first, then watches, then ok.
  const signals = [...data.signals].sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state],
  );

  return (
    <div className="mb-6">
      <Header />
      <div className={CARD}>
        {signals.map((signal) => (
          <SignalRow
            key={signal.id}
            signal={signal}
            active={SIGNAL_META[signal.id].drillType === currentType}
            onDrill={onDrill}
          />
        ))}
      </div>
    </div>
  );
}
