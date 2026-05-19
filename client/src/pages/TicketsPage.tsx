import {
  type PaginatedTickets,
  type TicketCategory,
  type TicketPriority,
  type TicketSortField,
  TicketView,
  UNCATEGORIZED_FILTER_VALUE,
} from "@helpdesk/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import axios from "axios";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import TicketFilters, {
  type CategoryFilterValue,
  type StatusFilterValue,
} from "@/components/TicketFilters";
import TicketPagination from "@/components/TicketPagination";
import TicketsTable from "@/components/TicketsTable";
import TicketViewChips from "@/components/TicketViewChips";
import PageHeader from "@/components/ui/PageHeader";

const PAGE_SIZE = 10;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function setParam(params: URLSearchParams, key: string, value: string | number | null) {
  const str = value == null ? "" : String(value);
  if (str && str !== "") params.set(key, str);
  else params.delete(key);
}

const VALID_VIEWS = new Set<string>(Object.values(TicketView));

type SlaStateFilterValue = "at_risk" | "ok" | "";
const VALID_SLA_STATES = new Set<string>(["at_risk", "ok"]);

async function fetchTickets(
  sortBy: TicketSortField,
  sortOrder: "asc" | "desc",
  status: StatusFilterValue,
  category: CategoryFilterValue,
  priority: TicketPriority | "",
  assignee: string,
  search: string,
  breachedOnly: boolean,
  slaState: SlaStateFilterValue,
  view: TicketView | null,
  page: number,
): Promise<PaginatedTickets> {
  const { data } = await axios.get<PaginatedTickets>("/api/tickets", {
    params: {
      sortBy,
      sortOrder,
      // When `view` is set the server applies its preset and ignores the
      // per-field filters, so we don't bother sending them. Keeps the
      // request URL meaningful.
      ...(view ? { view } : null),
      ...(!view && status && { status }),
      ...(!view && category && { category }),
      ...(!view && priority && { priority }),
      ...(!view && assignee && { assignee }),
      ...(!view && breachedOnly && { breachedOnly: "true" }),
      ...(!view && slaState && { slaState }),
      ...(search.trim() && { search: search.trim() }),
      page,
      pageSize: PAGE_SIZE,
    },
  });
  return data;
}

export default function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get("status") ?? "") as StatusFilterValue;
  // Accept either a TicketCategory value or the "uncategorized" sentinel
  // (server translates it to `category IS NULL`). Unknown values fall back
  // to "" (all categories).
  const categoryRaw = searchParams.get("category") ?? "";
  const category: CategoryFilterValue =
    categoryRaw === UNCATEGORIZED_FILTER_VALUE
      ? UNCATEGORIZED_FILTER_VALUE
      : (categoryRaw as TicketCategory | "");
  const priority = (searchParams.get("priority") ?? "") as TicketPriority | "";
  const assignee = searchParams.get("assignee") ?? "";
  const breachedOnly = searchParams.get("breachedOnly") === "true";
  const slaStateRaw = searchParams.get("slaState") ?? "";
  const slaState: SlaStateFilterValue = VALID_SLA_STATES.has(slaStateRaw)
    ? (slaStateRaw as SlaStateFilterValue)
    : "";
  const viewRaw = searchParams.get("view");
  const view: TicketView | null =
    viewRaw && VALID_VIEWS.has(viewRaw) ? (viewRaw as TicketView) : null;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const searchFromUrl = searchParams.get("q") ?? "";

  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Commit debounced search to URL; replace history so each keystroke after
  // debounce doesn't pollute the back stack.
  useEffect(() => {
    if (debouncedSearch === searchFromUrl) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        setParam(next, "q", debouncedSearch.trim());
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, searchFromUrl, setSearchParams]);

  const sortBy = (sorting[0]?.id ?? "createdAt") as TicketSortField;
  const sortOrder = sorting[0]?.desc === false ? "asc" : "desc";

  const { data, isPending, isError } = useQuery({
    queryKey: [
      "tickets",
      sortBy,
      sortOrder,
      status,
      category,
      priority,
      assignee,
      searchFromUrl,
      breachedOnly,
      slaState,
      view,
      page,
    ],
    queryFn: () =>
      fetchTickets(
        sortBy,
        sortOrder,
        status,
        category,
        priority,
        assignee,
        searchFromUrl,
        breachedOnly,
        slaState,
        view,
        page,
      ),
    placeholderData: keepPreviousData,
  });

  const tickets = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function updateFilter(
    key: "status" | "category" | "priority" | "breachedOnly",
    value: string,
  ) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      setParam(next, key, value);
      // Manually changing a per-field filter deactivates the active preset
      // chip — the URL should only ever carry one of `view` OR the
      // per-field filters, never both.
      next.delete("view");
      next.delete("page");
      return next;
    });
  }

  function onViewChange(next: TicketView | null) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      // Exclusive preset: clear every per-field filter when a chip is
      // toggled. Search (`q`) survives since it's a different axis.
      params.delete("status");
      params.delete("category");
      params.delete("priority");
      params.delete("assignee");
      params.delete("breachedOnly");
      params.delete("slaState");
      params.delete("page");
      if (next) {
        params.set("view", next);
      } else {
        params.delete("view");
      }
      return params;
    });
  }

  function setPageParam(nextPage: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextPage <= 1) next.delete("page");
      else next.set("page", String(nextPage));
      return next;
    });
  }

  const handleSortingChange = (
    updater: SortingState | ((prev: SortingState) => SortingState),
  ) => {
    setSorting(updater);
    setPageParam(1);
  };

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <main className="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6 md:px-8 md:pt-12 md:pb-16 lg:px-10 xl:px-12 xl:pt-16 2xl:px-16 2xl:pt-20">
      <PageHeader
        eyebrow="Queue"
        title="Tickets"
        description="Customer requests, auto-categorized by Gemini on arrival."
      />

      <TicketViewChips activeView={view} onChange={onViewChange} />

      <TicketFilters
        search={searchInput}
        status={status}
        category={category}
        priority={priority}
        breachedOnly={breachedOnly}
        onSearchChange={setSearchInput}
        onStatusChange={(v) => updateFilter("status", v)}
        onCategoryChange={(v) => updateFilter("category", v)}
        onPriorityChange={(v) => updateFilter("priority", v)}
        onBreachedOnlyChange={(v) => updateFilter("breachedOnly", v ? "true" : "")}
      />

      <TicketsTable
        tickets={tickets}
        isPending={isPending}
        isError={isError}
        sorting={sorting}
        onSortingChange={handleSortingChange}
      />

      <TicketPagination
        page={page}
        totalPages={totalPages}
        start={start}
        end={end}
        total={total}
        onPrevious={() => setPageParam(page - 1)}
        onNext={() => setPageParam(page + 1)}
      />
    </main>
  );
}
