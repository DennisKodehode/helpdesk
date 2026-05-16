import {
  type PaginatedTickets,
  type TicketSortField,
  TicketStatus,
} from "@helpdesk/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import axios from "axios";
import { useState } from "react";
import { useSearchParams } from "react-router";
import TicketPagination from "@/components/TicketPagination";
import TicketsTable from "@/components/TicketsTable";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

async function fetchMyTickets(
  status: TicketStatus,
  sortBy: TicketSortField,
  sortOrder: "asc" | "desc",
  page: number,
): Promise<PaginatedTickets> {
  const { data } = await axios.get<PaginatedTickets>("/api/tickets", {
    params: { assignee: "me", status, sortBy, sortOrder, page, pageSize: PAGE_SIZE },
  });
  return data;
}

interface ActiveProps {
  title: string;
  scope: "active";
}
interface ClosedProps {
  title: string;
  scope: "closed";
}
type Props = ActiveProps | ClosedProps;

export default function MyTicketsSection(props: Props) {
  const { title, scope } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  const pageParamKey = scope === "active" ? "activePage" : "closedPage";

  const activeFilter =
    scope === "active"
      ? ((searchParams.get("active") ?? TicketStatus.open) as TicketStatus)
      : TicketStatus.closed;

  const status: TicketStatus =
    scope === "closed"
      ? TicketStatus.closed
      : activeFilter === TicketStatus.resolved
        ? TicketStatus.resolved
        : TicketStatus.open;

  const page = Math.max(1, Number(searchParams.get(pageParamKey) ?? "1") || 1);

  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const sortBy = (sorting[0]?.id ?? "createdAt") as TicketSortField;
  const sortOrder = sorting[0]?.desc === false ? "asc" : "desc";

  const { data, isPending, isError } = useQuery({
    queryKey: ["tickets", "me", scope, status, sortBy, sortOrder, page],
    queryFn: () => fetchMyTickets(status, sortBy, sortOrder, page),
    placeholderData: keepPreviousData,
  });

  const tickets = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setPageParam(nextPage: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextPage <= 1) next.delete(pageParamKey);
      else next.set(pageParamKey, String(nextPage));
      return next;
    });
  }

  function setActiveFilter(value: TicketStatus.open | TicketStatus.resolved) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === TicketStatus.open) next.delete("active");
      else next.set("active", value);
      next.delete(pageParamKey);
      return next;
    });
  }

  function handleSortingChange(
    updater: SortingState | ((prev: SortingState) => SortingState),
  ) {
    setSorting(updater);
    setPageParam(1);
  }

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <section aria-labelledby={`my-tickets-${scope}`} className="mb-12 last:mb-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{scope === "active" ? "Working on" : "Archive"}</p>
          <h2
            id={`my-tickets-${scope}`}
            className="display-serif text-[22px] leading-tight tracking-[-0.01em] text-foreground sm:text-[26px] md:text-[30px]"
          >
            {title}
          </h2>
        </div>
        {scope === "active" && (
          // biome-ignore lint/a11y/useSemanticElements: compact pill toggle; fieldset/legend is too heavy here
          <div
            role="group"
            aria-label="Active status"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card p-0.5"
          >
            <FilterPill
              label="Open"
              active={activeFilter !== TicketStatus.resolved}
              onClick={() => setActiveFilter(TicketStatus.open)}
            />
            <FilterPill
              label="Resolved"
              active={activeFilter === TicketStatus.resolved}
              onClick={() => setActiveFilter(TicketStatus.resolved)}
            />
          </div>
        )}
      </div>

      <TicketsTable
        tickets={tickets}
        isPending={isPending}
        isError={isError}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        emptyTitle={
          scope === "closed"
            ? "Nothing closed yet"
            : status === TicketStatus.resolved
              ? "Nothing waiting to close"
              : "Nothing on your plate"
        }
        emptyDescription={
          scope === "closed"
            ? "Tickets you worked on will show up here once they close."
            : status === TicketStatus.resolved
              ? "Resolved tickets you're assigned to will show up here."
              : "Open tickets assigned to you will show up here."
        }
      />

      {totalPages > 1 && (
        <TicketPagination
          page={page}
          totalPages={totalPages}
          start={start}
          end={end}
          total={total}
          onPrevious={() => setPageParam(page - 1)}
          onNext={() => setPageParam(page + 1)}
        />
      )}
    </section>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
