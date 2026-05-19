import type {
  PaginatedTickets,
  TicketCategory,
  TicketPriority,
  TicketSortField,
} from "@helpdesk/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import axios from "axios";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import TicketFilters, { type StatusFilterValue } from "@/components/TicketFilters";
import TicketPagination from "@/components/TicketPagination";
import TicketsTable from "@/components/TicketsTable";
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

async function fetchTickets(
  sortBy: TicketSortField,
  sortOrder: "asc" | "desc",
  status: StatusFilterValue,
  category: TicketCategory | "",
  priority: TicketPriority | "",
  assignee: string,
  search: string,
  breachedOnly: boolean,
  page: number,
): Promise<PaginatedTickets> {
  const { data } = await axios.get<PaginatedTickets>("/api/tickets", {
    params: {
      sortBy,
      sortOrder,
      ...(status && { status }),
      ...(category && { category }),
      ...(priority && { priority }),
      ...(assignee && { assignee }),
      ...(search.trim() && { search: search.trim() }),
      ...(breachedOnly && { breachedOnly: "true" }),
      page,
      pageSize: PAGE_SIZE,
    },
  });
  return data;
}

export default function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get("status") ?? "") as StatusFilterValue;
  const category = (searchParams.get("category") ?? "") as TicketCategory | "";
  const priority = (searchParams.get("priority") ?? "") as TicketPriority | "";
  const assignee = searchParams.get("assignee") ?? "";
  const breachedOnly = searchParams.get("breachedOnly") === "true";
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
      next.delete("page");
      return next;
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
