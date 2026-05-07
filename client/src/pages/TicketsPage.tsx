import { useState, useEffect } from "react";
import axios from "axios";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { type SortingState } from "@tanstack/react-table";
import TicketsTable from "@/components/TicketsTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { type PaginatedTickets, type TicketSortField, TicketStatus, TicketCategory } from "@helpdesk/core";

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, string> = {
  "": "All statuses",
  [TicketStatus.open]: "Open",
  [TicketStatus.resolved]: "Resolved",
  [TicketStatus.closed]: "Closed",
};

const CATEGORY_LABELS: Record<string, string> = {
  "": "All categories",
  [TicketCategory.technical_question]: "Technical",
  [TicketCategory.billing_inquiry]: "Billing",
  [TicketCategory.refund_request]: "Refund",
  [TicketCategory.feature_request]: "Feature",
  [TicketCategory.general_question]: "General",
};

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
      </div>

      <div className="flex gap-3 mb-4">
        <Input
          aria-label="Search tickets"
          placeholder="Search by name, email or subject…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-8 w-72 text-sm"
        />

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as TicketStatus | ""); setPage(1); }}>
          <SelectTrigger aria-label="Status" size="sm" className="w-36">
            <SelectValue>{(v: string | null) => STATUS_LABELS[v ?? ""]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value={TicketStatus.open}>Open</SelectItem>
            <SelectItem value={TicketStatus.resolved}>Resolved</SelectItem>
            <SelectItem value={TicketStatus.closed}>Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v as TicketCategory | ""); setPage(1); }}>
          <SelectTrigger aria-label="Category" size="sm" className="w-40">
            <SelectValue>{(v: string | null) => CATEGORY_LABELS[v ?? ""]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All categories</SelectItem>
            <SelectItem value={TicketCategory.technical_question}>Technical</SelectItem>
            <SelectItem value={TicketCategory.billing_inquiry}>Billing</SelectItem>
            <SelectItem value={TicketCategory.refund_request}>Refund</SelectItem>
            <SelectItem value={TicketCategory.feature_request}>Feature</SelectItem>
            <SelectItem value={TicketCategory.general_question}>General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TicketsTable
        tickets={tickets}
        isPending={isPending}
        isError={isError}
        sorting={sorting}
        onSortingChange={handleSortingChange}
      />

      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-gray-500">
          {total > 0 ? `${start}–${end} of ${total}` : ""}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            aria-label="Previous page"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
