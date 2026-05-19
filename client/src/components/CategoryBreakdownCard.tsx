import type { CategoryBreakdownResponse, TicketCategory } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowUpRight } from "lucide-react";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS } from "@/lib/ticket-ui";

function labelFor(category: TicketCategory | null): string {
  return category === null ? "Uncategorized" : CATEGORY_LABELS[category];
}

function CategoryBreakdownSkeleton() {
  return (
    <section
      className="rounded-lg border border-border bg-card"
      role="status"
      aria-label="Loading category breakdown"
    >
      <div className="border-b border-[var(--hairline)] px-6 py-4">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="divide-y divide-[var(--hairline)] px-6">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder; never reorders
          <div key={i} className="space-y-2 py-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-6" />
            </div>
            <Skeleton className="h-1 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryRow({
  category,
  count,
  pct,
}: {
  category: TicketCategory | null;
  count: number;
  pct: number;
}) {
  const label = labelFor(category);
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-foreground">
          {label}
        </span>
        <span className="display-serif tabular text-[20px] leading-none text-foreground">
          {count}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-foreground/60 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  );

  if (category === null) {
    return <div className="py-3">{body}</div>;
  }

  return (
    <Link
      to={`/tickets?category=${category}`}
      className="group relative block py-3 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      aria-label={`${label}: ${count} open ${count === 1 ? "ticket" : "tickets"} — view`}
    >
      <ArrowUpRight
        className="pointer-events-none absolute right-0 top-3 size-3 text-muted-foreground/0 transition-colors duration-150 group-hover:text-muted-foreground group-focus-visible:text-muted-foreground"
        aria-hidden
      />
      {body}
    </Link>
  );
}

export default function CategoryBreakdownCard() {
  const query = useQuery<CategoryBreakdownResponse>({
    queryKey: ["stats", "categories"],
    queryFn: ({ signal }) =>
      axios
        .get<CategoryBreakdownResponse>("/api/stats/categories", { signal })
        .then((r) => r.data),
  });

  if (query.isLoading) return <CategoryBreakdownSkeleton />;

  if (query.isError) {
    return (
      <section className="rounded-lg border border-border bg-card p-6">
        <ErrorAlert
          message={
            query.error instanceof Error
              ? query.error.message
              : "Failed to load category breakdown"
          }
        />
      </section>
    );
  }

  const rows = query.data ?? [];
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);

  return (
    <section
      className="rounded-lg border border-border bg-card"
      aria-labelledby="category-breakdown-heading"
    >
      <div className="flex items-center justify-between border-b border-[var(--hairline)] px-6 py-4">
        <div>
          <h2 id="category-breakdown-heading" className="label-meta mb-0">
            Open by category
          </h2>
          <p className="font-mono text-[11px] text-muted-foreground/80 mt-1">
            {total === 0
              ? "no open tickets"
              : `${total} open ${total === 1 ? "ticket" : "tickets"}`}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <p className="px-6 py-10 text-center font-mono text-[12px] text-muted-foreground">
          Queue is clear.
        </p>
      ) : (
        <div className="divide-y divide-[var(--hairline)] px-6">
          {rows.map((row) => (
            <CategoryRow
              key={row.category ?? "__null__"}
              category={row.category}
              count={row.count}
              pct={max > 0 ? (row.count / max) * 100 : 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
