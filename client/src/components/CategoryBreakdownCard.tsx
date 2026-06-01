import {
  type CategoryBreakdownResponse,
  type TicketCategory,
  UNCATEGORIZED_FILTER_VALUE,
} from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, categoryDot } from "@/lib/ticket-ui";
import { cn } from "@/lib/utils";

function labelFor(category: TicketCategory | null): string {
  return category === null ? "Uncategorized" : CATEGORY_LABELS[category];
}

function hrefFor(category: TicketCategory | null): string {
  // `category=uncategorized` is a server-side sentinel translated to
  // `category IS NULL` in the WHERE clause (see ticketSortSchema +
  // tickets.ts categoryFilter). Mirrors the TRIAGING_FILTER_VALUE pattern.
  const value = category ?? UNCATEGORIZED_FILTER_VALUE;
  return `/tickets?category=${value}`;
}

function CategoryBreakdownSkeleton() {
  return (
    <section
      className="rounded-[var(--r-lg)] border border-border bg-card p-[22px]"
      role="status"
      aria-label="Loading category breakdown"
    >
      <Skeleton className="mb-[18px] h-3 w-32" />
      <div className="space-y-[15px]">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder; never reorders
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-6" />
            </div>
            <Skeleton className="h-[7px] w-full rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

// Each row: sans label + share-of-open percentage on the right, with a
// tone-coloured proportion bar below (the bar carries the tone — no extra dot).
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
  return (
    <Link
      to={hrefFor(category)}
      className="group block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      aria-label={`${label}: ${count} open ${count === 1 ? "ticket" : "tickets"} (${pct}%) — view`}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-2 group-hover:text-foreground">
          {label}
        </span>
        <span className="font-mono tabular text-[12px] text-ink-3">{pct}%</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-full bg-panel-inset" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            categoryDot(category),
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
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
      <section className="rounded-[var(--r-lg)] border border-border bg-card p-[22px]">
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

  return (
    <section
      className="rounded-[var(--r-lg)] border border-border bg-card p-[22px]"
      aria-labelledby="category-breakdown-heading"
    >
      <h2 id="category-breakdown-heading" className="eyebrow mb-[18px]">
        Open by category
      </h2>

      {total === 0 ? (
        <p className="py-6 text-center font-mono text-[12px] text-ink-3">
          Queue is clear.
        </p>
      ) : (
        <div className="space-y-[15px]">
          {rows.map((row) => (
            <CategoryRow
              key={row.category ?? "__null__"}
              category={row.category}
              count={row.count}
              pct={total > 0 ? Math.round((row.count / total) * 100) : 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
