import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { type TicketDetail, type Reply, SenderType } from "@helpdesk/core";

interface Props {
  ticket: TicketDetail;
}

async function fetchReplies(ticketId: number): Promise<Reply[]> {
  const { data } = await axios.get<Reply[]>(`/api/tickets/${ticketId}/replies`);
  return data;
}

export default function ReplyThread({ ticket }: Props) {
  const { data: replies = [] } = useQuery({
    queryKey: ["ticket-replies", String(ticket.id)],
    queryFn: () => fetchReplies(ticket.id),
  });

  if (replies.length === 0) {
    return <p className="text-sm text-gray-400 italic">No replies yet</p>;
  }

  return (
    <ul className="space-y-3" aria-label="Reply thread">
      {replies.map(reply => (
        <li
          key={reply.id}
          className={`flex flex-col gap-1 ${reply.senderType === SenderType.agent ? "items-end" : "items-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-lg border p-3 text-sm whitespace-pre-wrap leading-relaxed ${
              reply.senderType === SenderType.agent
                ? "bg-blue-50 border-blue-200 text-blue-900"
                : "bg-gray-50 border-gray-200 text-gray-800"
            }`}
          >
            {reply.body}
          </div>
          <p className="text-xs text-gray-400">
            {reply.senderType === SenderType.agent
              ? (reply.author?.name ?? "Agent")
              : ticket.fromName}
            {" · "}
            {new Date(reply.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
