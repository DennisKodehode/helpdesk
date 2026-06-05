import { type KbSuggestion, KbSuggestionSource } from "@helpdesk/core";
import { Check, Sparkles, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, formatRelative } from "@/lib/ticket-ui";

function categoryLabel(category: KbSuggestion["category"]): string {
  return category ? CATEGORY_LABELS[category] : "General";
}

function SourceCell({ suggestion }: { suggestion: KbSuggestion }) {
  if (suggestion.source === KbSuggestionSource.ai_gap_analysis) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
        <Sparkles className="size-3.5 text-accent-ink" aria-hidden /> AI
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
      <UserRound className="size-3.5 text-ink-3" aria-hidden />
      {suggestion.requestedByName ?? "Agent"}
    </span>
  );
}

function ticketCount(suggestion: KbSuggestion): number {
  return suggestion.sourceTicketIds?.length ?? 0;
}

interface Props {
  suggestions: KbSuggestion[];
  isPending: boolean;
  isError: boolean;
  onApprove: (suggestion: KbSuggestion) => void;
  onReject: (suggestion: KbSuggestion) => void;
}

export default function KbSuggestionTable({
  suggestions,
  isPending,
  isError,
  onApprove,
  onReject,
}: Props) {
  if (isError) return <ErrorAlert message="Failed to load suggestions" />;

  function RowActions({ suggestion }: { suggestion: KbSuggestion }) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="accent" onClick={() => onApprove(suggestion)}>
          <Check className="size-4" aria-hidden /> Review
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Reject ${suggestion.title}`}
          onClick={() => onReject(suggestion)}
        >
          <X className="size-4" aria-hidden /> Reject
        </Button>
      </div>
    );
  }

  if (!isPending && suggestions.length === 0) {
    return (
      <div className="rounded-[var(--r-lg)] border border-border bg-card p-12 text-center">
        <p className="display-serif text-2xl text-muted-foreground">
          No suggestions waiting.
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground/70">
          The AI proposes articles from recurring resolved tickets on a schedule, and
          agents can suggest from a ticket. They'll appear here for review.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table — lg+ */}
      <div className="hidden overflow-x-auto rounded-[var(--r-lg)] border border-border bg-card lg:block">
        <table className="min-w-[820px] w-full border-collapse">
          <thead>
            <tr className="hairline-b bg-panel-2">
              {["Proposed article", "Category", "Source"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground first:pl-[18px]"
                >
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Tickets
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Proposed
              </th>
              <th className="w-[200px]" />
            </tr>
          </thead>
          <tbody>
            {isPending
              ? Array.from({ length: 3 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                  <tr key={i} className="hairline-b">
                    <td className="px-4 py-[15px] pl-[18px]">
                      <Skeleton className="h-9 w-64" />
                    </td>
                    {Array.from({ length: 4 }).map((__, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                      <td key={j} className="px-4 py-[15px]">
                        <Skeleton className="h-4 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              : suggestions.map((s) => (
                  <tr
                    key={s.id}
                    className="hairline-b transition-colors hover:bg-panel-2"
                  >
                    <td className="px-4 py-[15px] pl-[18px]">
                      <div className="min-w-0">
                        <div className="text-[14.5px] font-semibold text-foreground">
                          {s.title}
                        </div>
                        <div className="truncate text-[12.5px] text-ink-4">
                          {s.question}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-[15px] text-[13px] text-ink-2">
                      {categoryLabel(s.category)}
                    </td>
                    <td className="px-4 py-[15px]">
                      <SourceCell suggestion={s} />
                    </td>
                    <td className="px-4 py-[15px] text-right font-mono tabular text-[14px] text-ink-2">
                      {ticketCount(s)}
                    </td>
                    <td className="px-4 py-[15px] font-mono text-[12px] whitespace-nowrap text-ink-3">
                      {formatRelative(s.createdAt)}
                    </td>
                    <td className="px-4 py-[15px]">
                      <RowActions suggestion={s} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — below lg */}
      <ul className="space-y-2 lg:hidden">
        {isPending
          ? Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
              <li key={i}>
                <Skeleton className="h-28 w-full rounded-[var(--r-lg)]" />
              </li>
            ))
          : suggestions.map((s) => (
              <li
                key={s.id}
                className="rounded-[var(--r-lg)] border border-border bg-card p-4"
              >
                <div className="text-[14.5px] font-semibold text-foreground">
                  {s.title}
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink-4">{s.question}</div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 font-mono text-[12px] text-ink-3">
                    <span>{categoryLabel(s.category)}</span>
                    <SourceCell suggestion={s} />
                    <span>{ticketCount(s)} tickets</span>
                  </div>
                </div>
                <div className="mt-3">
                  <RowActions suggestion={s} />
                </div>
              </li>
            ))}
      </ul>
    </>
  );
}
