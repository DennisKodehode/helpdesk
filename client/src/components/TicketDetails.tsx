import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import DOMPurify from "dompurify";
import { type TicketDetail } from "@helpdesk/core";
import { Button } from "@/components/ui/button";
import ErrorAlert from "@/components/ui/ErrorAlert";

interface Props {
  ticket: TicketDetail;
}

export default function TicketDetails({ ticket }: Props) {
  const summarizeMutation = useMutation({
    mutationFn: () =>
      axios.post<{ summary: string }>(`/api/tickets/${ticket.id}/summarize`),
  });

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
          <dt className="inline text-gray-500 font-medium after:content-[':']">Received</dt>{" "}
          <dd className="inline text-gray-900">{new Date(ticket.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="inline text-gray-500 font-medium after:content-[':']">Updated</dt>{" "}
          <dd className="inline text-gray-900">{new Date(ticket.updatedAt).toLocaleString()}</dd>
        </div>
      </dl>

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <h2 className="mb-2">Message</h2>
        {(ticket.bodyHtml ?? ticket.body) ? (
          <div
            className="bg-white rounded-lg border border-gray-200 p-4 text-gray-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.bodyHtml ?? ticket.body.replace(/\n/g, "<br>")) }}
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm">
            <span className="text-gray-400 italic">(no message body)</span>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={summarizeMutation.isPending}
          onClick={() => summarizeMutation.mutate()}
        >
          <Sparkles className="size-4" />
          {summarizeMutation.isPending ? "Summarizing…" : "Summarize"}
        </Button>

        {summarizeMutation.isError && (
          <ErrorAlert message="Failed to generate summary. Please try again." />
        )}

        {summarizeMutation.data && (
          <div className="rounded-md bg-gray-50 border border-gray-200 p-4 text-gray-700">
            {summarizeMutation.data.data.summary}
          </div>
        )}
      </div>
    </>
  );
}
