import { type Reply, SenderType, type TicketDetail } from "@helpdesk/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import DOMPurify from "dompurify";
import { Sparkles } from "lucide-react";
import ErrorAlert from "@/components/ui/ErrorAlert";

interface Props {
  ticket: TicketDetail;
}

async function fetchReplies(ticketId: number): Promise<Reply[]> {
  const { data } = await axios.get<Reply[]>(`/api/tickets/${ticketId}/replies`);
  return data;
}

type Message = {
  id: string;
  isAgent: boolean;
  isInternal: boolean;
  senderLabel: string;
  senderName: string;
  html: string;
  createdAt: string;
};

export default function ReplyThread({ ticket }: Props) {
  const { data: replies = [] } = useQuery({
    queryKey: ["ticket-replies", String(ticket.id)],
    queryFn: () => fetchReplies(ticket.id),
  });

  const summarizeMutation = useMutation({
    mutationFn: () =>
      axios.post<{ summary: string }>(`/api/tickets/${ticket.id}/summarize`),
  });

  const originalHtml =
    ticket.bodyHtml ?? (ticket.body ? ticket.body.replace(/\n/g, "<br>") : "");

  const messages: Message[] = [
    {
      id: "original",
      isAgent: false,
      isInternal: false,
      senderLabel: "Customer",
      senderName: ticket.fromName,
      html: originalHtml,
      createdAt: ticket.createdAt,
    },
    ...replies.map((r: Reply) => {
      const isInternal = r.senderType === SenderType.internal_note;
      const isAgent = r.senderType === SenderType.agent;
      const isAgentSide = isAgent || isInternal;
      return {
        id: String(r.id),
        isAgent,
        isInternal,
        senderLabel: isInternal ? "Internal" : isAgent ? "Agent" : "Customer",
        senderName: isAgentSide ? (r.author?.name ?? "AI") : ticket.fromName,
        html: r.bodyHtml ?? r.body.replace(/\n/g, "<br>"),
        createdAt: r.createdAt,
      };
    }),
  ];

  return (
    <section className="mx-auto w-full space-y-5 lg:max-w-3xl xl:max-w-4xl">
      {/* Section rail */}
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">Conversation · {messages.length}</h2>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
          disabled={summarizeMutation.isPending}
          onClick={() => summarizeMutation.mutate()}
        >
          <Sparkles className="size-3" />
          {summarizeMutation.isPending ? "Summarizing…" : "Summarize ticket"}
        </button>
      </div>

      {summarizeMutation.isError && (
        <ErrorAlert message="Failed to generate summary. Please try again." />
      )}

      {summarizeMutation.data && (
        <blockquote className="hairline-l rounded-r-md bg-muted/40 px-5 py-4 text-[13.5px] leading-relaxed text-foreground">
          <p className="eyebrow mb-2 text-primary">Summary</p>
          {summarizeMutation.data.data.summary}
        </blockquote>
      )}

      <ol className="space-y-7" aria-label="Reply thread">
        {messages.map((msg, idx) => {
          const initial = msg.senderName?.trim().charAt(0).toUpperCase() ?? "?";
          const time = new Date(msg.createdAt);

          return (
            <li
              key={msg.id}
              id={msg.id === "original" ? undefined : `reply-${msg.id}`}
              className="relative scroll-mt-20"
            >
              {/* Vertical thread line */}
              {idx < messages.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[15px] top-9 bottom-[-1.75rem] w-px bg-border"
                />
              )}

              <div className="flex gap-3 sm:gap-4">
                {/* Avatar */}
                <div
                  className={`relative z-[1] grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-medium ${
                    msg.isInternal
                      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900/70"
                      : msg.isAgent
                        ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                        : "bg-card text-muted-foreground ring-1 ring-border"
                  }`}
                >
                  {initial}
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  {/* Sender meta */}
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[13.5px] font-medium text-foreground leading-none">
                      {msg.senderName}
                    </span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.15em] ${
                        msg.isInternal
                          ? "text-amber-700 dark:text-amber-300"
                          : msg.isAgent
                            ? "text-primary"
                            : "text-muted-foreground/70"
                      }`}
                    >
                      {msg.senderLabel}
                    </span>
                    <span className="ml-auto font-mono tabular text-[10px] text-muted-foreground/70">
                      {time.toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  {/* Body */}
                  {msg.html ? (
                    <div
                      className={`prose-reply rounded-md px-4 py-3 text-[14px] leading-[1.65] text-foreground ${
                        msg.isInternal
                          ? "bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900/50"
                          : msg.isAgent
                            ? "bg-primary/[0.04] ring-1 ring-primary/15 dark:bg-primary/[0.07] dark:ring-primary/20"
                            : "bg-card ring-1 ring-border"
                      }`}
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: rendered HTML is sanitized with DOMPurify
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(msg.html),
                      }}
                    />
                  ) : (
                    <div className="rounded-md bg-card px-4 py-3 text-[14px] italic text-muted-foreground ring-1 ring-border">
                      (no message body)
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
