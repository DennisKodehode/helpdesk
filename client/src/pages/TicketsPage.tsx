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
import { type Ticket, type TicketSortField, TicketStatus, TicketCategory } from "@helpdesk/core";

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
  search: string
): Promise<Ticket[]> {
  const { data } = await axios.get<Ticket[]>("/api/tickets", {
    params: {
      sortBy,
      sortOrder,
      ...(status && { status }),
      ...(category && { category }),
      ...(search.trim() && { search: search.trim() }),
    },
  });
  return data;
}

export default function TicketsPage() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | "">("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  const sortBy = (sorting[0]?.id ?? "createdAt") as TicketSortField;
  const sortOrder = sorting[0]?.desc === false ? "asc" : "desc";

  const { data: tickets = [], isPending, isError } = useQuery({
    queryKey: ["tickets", sortBy, sortOrder, statusFilter, categoryFilter, debouncedSearch],
    queryFn: () => fetchTickets(sortBy, sortOrder, statusFilter, categoryFilter, debouncedSearch),
    placeholderData: keepPreviousData,
  });

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

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TicketStatus | "")}>
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

        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as TicketCategory | "")}>
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
        onSortingChange={setSorting}
      />
    </main>
  );
}
