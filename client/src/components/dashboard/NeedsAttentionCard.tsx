import type { NeedsAttentionResponse } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowRight } from "lucide-react";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { BADGE_BASE, SLA_DOT, SLA_LABELS, SLA_STYLES } from "@/lib/ticket-ui";

export default function NeedsAttentionCard() {
  const query = useQuery<NeedsAttentionResponse>({
    queryKey: ["stats", "needs-attention"],
    queryFn: ({ signal }) =>
      axios
        .get<NeedsAttentionResponse>("/api/stats/needs-attention", { signal })
        .then((r) => r.data),
  });

  return (
    <section
      aria-labelledby="needs-attention-heading"
      className="overflow-hidden rounded-[var(--r-lg)] border border-border bg-card"
    >
      <div className="hairline-b flex items-center justify-between bg-panel-2 px-5 py-3">
        <h2 id="needs-attention-heading" className="eyebrow">
          Needs attention
        </h2>
        <Link
          to="/tickets?breachedOnly=true"
          className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3 hover:text-foreground"
        >
          All <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>

      <div className="px-5">
        {query.isLoading ? (
          <div className="space-y-3 py-4" role="status" aria-label="Loading">
            {Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="py-8 text-center font-mono text-[12px] text-ink-3">
            Failed to load.
          </p>
        ) : query.data && query.data.length > 0 ? (
          <ul className="divide-y divide-[var(--hairline)]">
            {query.data.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/tickets/${t.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-foreground">
                      {t.subject}
                    </span>
                    <span className="font-mono tabular text-[11px] text-ink-4">
                      #{String(t.id).padStart(4, "0")}
                    </span>
                  </span>
                  <span className={`${BADGE_BASE} ${SLA_STYLES[t.slaState]} shrink-0`}>
                    <span
                      aria-hidden
                      className={`size-1.5 rounded-full ${SLA_DOT[t.slaState]}`}
                    />
                    {SLA_LABELS[t.slaState]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center font-mono text-[12px] text-ink-3">
            Nothing at risk. Nice.
          </p>
        )}
      </div>
    </section>
  );
}
