import { useState, useEffect } from "react";
import axios from "axios";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { type SortingState } from "@tanstack/react-table";
import TicketsTable from "@/components/TicketsTable";
import TicketFilters from "@/components/TicketFilters";
import TicketPagination from "@/components/TicketPagination";
import PageHeader from "@/components/ui/PageHeader";
import { type PaginatedTickets, type TicketSortField, TicketStatus, TicketCategory } from "@helpdesk/core";

const PAGE_SIZE = 10;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function fetchTickets(
  sortBy: TicketSortField,
  sortOrder: "asc" | "desc",
  status: TicketStatus | "",
  category: TicketCategory | "",
  search: string,
  page: number
): Promise<PaginatedTickets> {
  const { data } = await axios.get<PaginatedTickets>("/api/tickets", {
    params: {
      sortBy,
      sortOrder,
      ...(status && { status }),
      ...(category && { category }),
      ...(search.trim() && { search: search.trim() }),
      page,
      pageSize: PAGE_SIZE,
    },
  });
  return data;
}

export default function TicketsPage() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const sortBy = (sorting[0]?.id ?? "createdAt") as TicketSortField;
  const sortOrder = sorting[0]?.desc === false ? "asc" : "desc";

  const { data, isPending, isError } = useQuery({
    queryKey: ["tickets", sortBy, sortOrder, statusFilter, categoryFilter, debouncedSearch, page],
    queryFn: () => fetchTickets(sortBy, sortOrder, statusFilter, categoryFilter, debouncedSearch, page),
    placeholderData: keepPreviousData,
  });

  const tickets = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSortingChange = (updater: SortingState | ((prev: SortingState) => SortingState)) => {
    setSorting(updater);
    setPage(1);
  };

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <main className="p-8">
      <PageHeader title="Tickets" />

      <TicketFilters
        search={searchInput}
        status={statusFilter}
        category={categoryFilter}
        onSearchChange={setSearchInput}
        onStatusChange={(v) => { setStatusFilter(v); setPage(1); }}
        onCategoryChange={(v) => { setCategoryFilter(v); setPage(1); }}
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
        onPrevious={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
    </main>
  );
}
