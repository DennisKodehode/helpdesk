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
      className="rounded-[var(--r-lg)] border border-border bg-card px-[22px] pt-[22px] pb-3.5"
    >
      <div className="mb-3.5 flex items-center justify-between">
        <h2 id="needs-attention-heading" className="eyebrow">
          Needs attention
        </h2>
        <Link
          to="/tickets?breachedOnly=true"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-ink hover:text-foreground"
        >
          All <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>

      {query.isLoading ? (
        <div className="space-y-3 py-2" role="status" aria-label="Loading">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="py-6 text-center font-mono text-[12px] text-ink-3">
          Failed to load.
        </p>
      ) : query.data && query.data.length > 0 ? (
        <ul>
          {query.data.map((t) => (
            <li key={t.id}>
              <Link
                to={`/tickets/${t.id}`}
                className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] py-[11px] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium leading-[1.2] text-foreground">
                    {t.subject}
                  </span>
                  <span className="mt-0.5 block font-mono tabular text-[11px] leading-none text-ink-4">
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
        <p className="py-6 text-center font-mono text-[12px] text-ink-3">
          Nothing at risk. Nice.
        </p>
      )}
    </section>
  );
}
