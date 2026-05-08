import { type TicketDetail } from "@helpdesk/core";

interface Props {
  ticket: TicketDetail;
}

export default function TicketDetails({ ticket }: Props) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-gray-900">{ticket.subject}</h1>

      <dl className="text-sm space-y-3 border-t border-gray-100 pt-4">
        <div>
          <dt className="text-gray-500 font-medium">From</dt>
          <dd className="text-gray-900">{ticket.fromName}</dd>
          <dd className="text-gray-500">{ticket.fromEmail}</dd>
        </div>
        <div>
          <dt className="text-gray-500 font-medium">Received</dt>
          <dd className="text-gray-900">{new Date(ticket.createdAt).toLocaleString()}</dd>
        </div>
      </dl>

      <div className="border-t border-gray-100 pt-4">
        <h2 className="mb-2">Message</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
          {ticket.body || <span className="text-gray-400 italic">(no message body)</span>}
        </div>
      </div>
    </>
  );
}
