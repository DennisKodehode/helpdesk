import {
  type TicketCategory,
  type TicketPriority,
  type TicketSortField,
  TicketView,
  UNCATEGORIZED_FILTER_VALUE,
} from "@helpdesk/core";
import type { SortingState } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import MobileTicketsList from "@/components/mobile/MobileTicketsList";
import ScopeToggle from "@/components/ScopeToggle";
import TicketFilters, {
  type CategoryFilterValue,
  type StatusFilterValue,
} from "@/components/TicketFilters";
import TicketPagination from "@/components/TicketPagination";
import TicketsTable from "@/components/TicketsTable";
import TicketViewChips from "@/components/TicketViewChips";
import TabletTicketsMasterDetail from "@/components/tablet/TabletTicketsMasterDetail";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import { type SlaStateFilterValue, useTickets } from "@/lib/tickets";
import { useDebounce } from "@/lib/use-debounce";
import { useLayoutTier } from "@/lib/useBreakpoint";

const PAGE_SIZE = 10;

/**
 * Route dispatcher for `/tickets`. Mobile gets the bespoke master list; tablet
 * gets the two-pane master-detail (bare `/tickets` shows the "select a ticket"
 * empty state; selection navigates to `/tickets/:id`); desktop gets the queue
 * table.
 */
export default function TicketsPage() {
  const tier = useLayoutTier();
  const navigate = useNavigate();

  if (tier === "mobile") return <MobileTicketsList scope="all" />;

  if (tier === "tablet") {
    return (
      <TabletTicketsMasterDetail
        scope="all"
        selectedId={undefined}
        onSelect={(id) => navigate(`/tickets/${id}`)}
      />
    );
  }

  return <TicketsQueue />;
}

function setParam(params: URLSearchParams, key: string, value: string | number | null) {
  const str = value == null ? "" : String(value);
  if (str && str !== "") params.set(key, str);
  else params.delete(key);
}

const VALID_VIEWS = new Set<string>(Object.values(TicketView));

const VALID_SLA_STATES = new Set<string>(["at_risk", "ok"]);

function TicketsQueue() {
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
  const archived = searchParams.get("archived") === "1";
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

  const { data, isPending, isError } = useTickets({
    sortBy,
    sortOrder,
    status,
    category,
    priority,
    assignee,
    search: searchFromUrl,
    breachedOnly,
    slaState,
    view,
    archived,
    page,
    pageSize: PAGE_SIZE,
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

  // Active ⇄ Archive scope switch. Clears the Active-only axes (view + the
  // status/SLA filters) and resets paging; search/category/priority carry over.
  function onScopeChange(nextArchived: boolean) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("view");
      params.delete("status");
      params.delete("breachedOnly");
      params.delete("slaState");
      params.delete("page");
      if (nextArchived) params.set("archived", "1");
      else params.delete("archived");
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
    <PageContainer width="queue">
      <PageHeader
        eyebrow="Queue"
        title="Tickets"
        description="Customer requests, auto-categorized by Gemini on arrival."
      />

      <div className="mb-4">
        <ScopeToggle archived={archived} onChange={onScopeChange} />
      </div>

      {!archived && <TicketViewChips activeView={view} onChange={onViewChange} />}

      <TicketFilters
        search={searchInput}
        status={status}
        category={category}
        priority={priority}
        breachedOnly={breachedOnly}
        archived={archived}
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
        {...(archived && {
          emptyTitle: "Nothing archived",
          emptyDescription: "Closed tickets show up here once they're done.",
        })}
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
    </PageContainer>
  );
}
