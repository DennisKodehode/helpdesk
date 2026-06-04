import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { useSlaCompliance } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { useWorkflowSettings } from "@/lib/workflow-settings";

const RADIUS = 34;
const CIRC = 2 * Math.PI * RADIUS;

// Fallback thresholds while workflow settings load (mirrors the server defaults).
const DEFAULT_GREEN_MIN = 90;
const DEFAULT_YELLOW_MIN = 60;

// Ring tone by compliance: green (healthy) / amber (slipping) / red (breaching).
// Thresholds are admin-configurable (Workflow → SLA targets).
function ringStroke(pct: number | null, greenMin: number, yellowMin: number): string {
  if (pct == null) return "stroke-ink-4";
  if (pct >= greenMin) return "stroke-eme-dot";
  if (pct >= yellowMin) return "stroke-amb-dot";
  return "stroke-ros-dot";
}

function Ring({
  label,
  pct,
  greenMin,
  yellowMin,
}: {
  label: string;
  pct: number | null;
  greenMin: number;
  yellowMin: number;
}) {
  const value = pct ?? 0;
  const offset = CIRC * (1 - value / 100);
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative size-[78px]">
        {/* -rotate-90 starts the arc at 12 o'clock */}
        {/* Decorative — the percentage is announced via the adjacent text. */}
        <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden="true">
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            strokeWidth="6"
            className="stroke-panel-inset"
          />
          {pct != null && (
            <circle
              cx="40"
              cy="40"
              r={RADIUS}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className={cn(
                "transition-[stroke-dashoffset] duration-500",
                ringStroke(pct, greenMin, yellowMin),
              )}
              style={{ strokeDasharray: CIRC, strokeDashoffset: offset }}
            />
          )}
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          <span className="display-serif tabular text-[21px] leading-none text-foreground">
            {pct == null ? "—" : pct}
          </span>
        </span>
      </div>
      <p className="label-meta text-center">{label}</p>
    </div>
  );
}

export default function SlaRingsCard() {
  const query = useSlaCompliance();

  // Admin-configured colour thresholds; fall back to defaults while loading.
  const settings = useWorkflowSettings();
  const greenMin = settings.data?.slaGreenMin ?? DEFAULT_GREEN_MIN;
  const yellowMin = settings.data?.slaYellowMin ?? DEFAULT_YELLOW_MIN;

  return (
    <section
      aria-labelledby="sla-compliance-heading"
      className="rounded-[var(--r-lg)] border border-border bg-card p-[22px]"
    >
      <h2 id="sla-compliance-heading" className="eyebrow mb-[18px]">
        SLA compliance · 30d
      </h2>
      {query.isLoading ? (
        <div className="flex justify-around" role="status" aria-label="Loading">
          <Skeleton className="size-[78px] rounded-full" />
          <Skeleton className="size-[78px] rounded-full" />
        </div>
      ) : query.isError ? (
        <ErrorAlert message="Failed to load SLA compliance" />
      ) : (
        <div className="flex justify-around">
          <Ring
            label="First response"
            pct={query.data?.firstResponse ?? null}
            greenMin={greenMin}
            yellowMin={yellowMin}
          />
          <Ring
            label="Resolution"
            pct={query.data?.resolution ?? null}
            greenMin={greenMin}
            yellowMin={yellowMin}
          />
        </div>
      )}
    </section>
  );
}
