import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { useSlaHealth } from "@/lib/sla-policies";

const SEGMENTS = [
  { key: "breached", label: "Breached", dot: "bg-ros-dot" },
  { key: "atRisk", label: "At risk", dot: "bg-amb-dot" },
  { key: "ok", label: "On track", dot: "bg-eme-dot" },
] as const;

const CARD = "rounded-[var(--r-lg)] border border-border bg-card px-[26px] py-[22px]";

export default function SlaHealthCard() {
  const { data, isPending, isError } = useSlaHealth();

  if (isError) {
    return (
      <div className={`mb-[22px] ${CARD}`}>
        <ErrorAlert message="Failed to load SLA health" />
      </div>
    );
  }
  if (isPending || !data) {
    return (
      <div className={`mb-[22px] ${CARD}`} role="status" aria-label="Loading SLA health">
        <Skeleton className="h-3 w-40" />
        <div className="mt-5 flex gap-10">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
        </div>
      </div>
    );
  }

  const total = data.total;
  return (
    <section aria-labelledby="sla-health-heading" className={`mb-[22px] ${CARD}`}>
      <div className="mb-[18px] flex items-baseline justify-between">
        <h2 id="sla-health-heading" className="eyebrow">
          Current health · live
        </h2>
        <span className="font-mono text-[11px] text-ink-4">{total} active tickets</span>
      </div>

      <div className="flex flex-wrap items-end gap-10">
        {SEGMENTS.map((s) => (
          <div key={s.key}>
            <div className="flex items-baseline gap-2">
              <span aria-hidden className={`size-2 rounded-full ${s.dot}`} />
              <span className="display-serif tabular text-[40px] leading-[0.9] text-foreground">
                {data[s.key]}
              </span>
            </div>
            <div className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-4">
              {s.label}
            </div>
          </div>
        ))}

        <div className="min-w-[180px] flex-1">
          {/* Stacked proportion bar — segments sized by share of total. */}
          <div
            className="flex h-[9px] overflow-hidden rounded-full bg-panel-inset"
            aria-hidden
          >
            {SEGMENTS.map((s) =>
              data[s.key] > 0 && total > 0 ? (
                <div
                  key={s.key}
                  className={s.dot}
                  style={{ width: `${(data[s.key] / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-3.5 flex gap-5">
            {(
              [
                ["First response", data.byMetric.firstResponse],
                ["Resolution", data.byMetric.resolution],
              ] as const
            ).map(([label, m]) => (
              <div key={label} className="text-[12.5px] text-ink-3">
                <span className="font-semibold text-ink-2">{label}</span>
                <span className="ml-2 font-mono text-ink-4">
                  {m.breached} breached · {m.atRisk} at risk
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
