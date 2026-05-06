import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import TicketsTable from "@/components/TicketsTable";
import { type Ticket } from "@helpdesk/core";

async function fetchTickets(): Promise<Ticket[]> {
  const { data } = await axios.get<Ticket[]>("/api/tickets");
  return data;
}

export default function TicketsPage() {
  const { data: tickets = [], isPending, isError } = useQuery({
    queryKey: ["tickets"],
    queryFn: fetchTickets,
  });

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
      </div>

      <TicketsTable tickets={tickets} isPending={isPending} isError={isError} />
    </main>
  );
}
