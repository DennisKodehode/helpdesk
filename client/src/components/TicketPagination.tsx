import { ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}

export default function TicketPagination({
  page,
  totalPages,
  start,
  end,
  total,
  onPrevious,
  onNext,
}: Props) {
  return (
    <div className="mt-5 flex items-center justify-between">
      <p className="font-mono tabular text-[12px] uppercase tracking-[0.14em] text-muted-foreground md:text-[11px]">
        {total > 0 ? `${start}–${end} of ${total}` : ""}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={onPrevious}
          disabled={page === 1}
          aria-label="Previous page"
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent md:h-8 md:px-2.5 md:text-[11px]"
        >
          <ArrowLeft className="size-3" />
          Prev
        </button>
        <span className="px-3 font-mono tabular text-[12px] text-muted-foreground md:text-[11px]">
          {`${page} / ${totalPages}`}
        </span>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent md:h-8 md:px-2.5 md:text-[11px]"
        >
          Next
          <ArrowRight className="size-3" />
        </button>
      </div>
    </div>
  );
}
