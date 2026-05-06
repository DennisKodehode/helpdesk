import { type Ticket, TicketStatus, TicketCategory } from "@helpdesk/core";
import { Skeleton } from "@/components/ui/skeleton";

interface TicketsTableProps {
  tickets: Ticket[];
  isPending: boolean;
  isError: boolean;
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  [TicketStatus.open]: "bg-amber-100 text-amber-700",
  [TicketStatus.resolved]: "bg-green-100 text-green-700",
  [TicketStatus.closed]: "bg-gray-100 text-gray-500",
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  [TicketCategory.general_question]: "General",
  [TicketCategory.technical_question]: "Technical",
  [TicketCategory.refund_request]: "Refund",
};

export default function TicketsTable({ tickets, isPending, isError }: TicketsTableProps) {
  if (isError) {
    return <p className="text-sm text-red-500">Failed to load tickets</p>;
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["Subject", "From", "Status", "Category", "Received"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {isPending ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded" /></td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
              </tr>
            ))
          ) : tickets.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                No tickets yet
              </td>
            </tr>
          ) : (
            tickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">
                  {ticket.subject}
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{ticket.fromName}</p>
                  <p className="text-xs text-gray-500">{ticket.fromEmail}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[ticket.status as TicketStatus]}`}>
                    {ticket.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {ticket.category ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      {CATEGORY_LABELS[ticket.category as TicketCategory]}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
