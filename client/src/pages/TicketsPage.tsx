import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { type SortingState } from "@tanstack/react-table";
import TicketsTable from "@/components/TicketsTable";
import { type Ticket, type TicketSortField } from "@helpdesk/core";

async function fetchTickets(sortBy: TicketSortField, sortOrder: "asc" | "desc"): Promise<Ticket[]> {
  const { data } = await axios.get<Ticket[]>("/api/tickets", {
    params: { sortBy, sortOrder },
  });
  return data;
}

export default function TicketsPage() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const sortBy = (sorting[0]?.id ?? "createdAt") as TicketSortField;
  const sortOrder = sorting[0]?.desc === false ? "asc" : "desc";

  const { data: tickets = [], isPending, isError } = useQuery({
    queryKey: ["tickets", sortBy, sortOrder],
    queryFn: () => fetchTickets(sortBy, sortOrder),
  });

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
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
