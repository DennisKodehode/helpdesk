import type { Ticket, TicketStatus } from "@helpdesk/core";
import { TicketPriority, type TicketView } from "@helpdesk/core";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { SlaBadge } from "@/components/SlaBadge";
import StatusPill from "@/components/StatusPill";
import TicketViewChips from "@/components/TicketViewChips";
import {
  BADGE_BASE,
  CATEGORY_BADGE,
  CATEGORY_LABELS,
  formatCaseId,
  formatRelative,
  isTriagingStatus,
  PRIORITY_DOT,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
} from "@/lib/ticket-ui";
import { useTickets } from "@/lib/tickets";
import { useDebounce } from "@/lib/use-debounce";
import MobileHead from "./MobileHead";

const LIST_SIZE = 50;

interface Props {
  scope: "all" | "mine";
}

export default function MobileTicketsList({ scope }: Props) {
  const navigate = useNavigate();
  const [view, setView] = useState<TicketView | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isPending, isError } = useTickets({
    sortBy: "createdAt",
    sortOrder: "desc",
    status: "",
    category: "",
    priority: "",
    assignee: scope === "mine" ? "me" : "",
    search: debouncedSearch,
    breachedOnly: false,
    slaState: "",
    view: scope === "all" ? view : null,
    page: 1,
    pageSize: LIST_SIZE,
  });

  const tickets = data?.data ?? [];

  return (
    <>
      <MobileHead
        eyebrow={scope === "mine" ? "Assigned to me" : "Queue"}
        title={scope === "mine" ? "My tickets" : "Tickets"}
      />

      <div className="px-4 pb-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4"
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search tickets"
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-[var(--r-sm)] border border-hairline-strong bg-panel pl-9 pr-3 text-[13.5px] text-foreground transition-colors placeholder:text-ink-4 focus:border-primary focus:outline-none focus:ring-3 focus:ring-accent-tint"
          />
        </div>
      </div>

      {scope === "all" && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3.5 [scrollbar-width:none]">
          <TicketViewChips activeView={view} onChange={setView} />
        </div>
      )}

      <div className="space-y-2.5 px-4">
        {isError ? (
          <p className="py-10 text-center text-[13.5px] text-ros-fg">
            Failed to load tickets.
          </p>
        ) : isPending ? (
          ["s1", "s2", "s3", "s4", "s5"].map((k) => (
            <div
              key={k}
              className="h-[104px] rounded-[var(--r-lg)] border border-border bg-card"
            />
          ))
        ) : tickets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="display-serif text-[20px] text-ink-2">Nothing in this view.</p>
            <p className="mt-1.5 text-[13.5px] text-ink-3">Try clearing a filter.</p>
          </div>
        ) : (
          tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              onClick={() => navigate(`/tickets/${t.id}`)}
            />
          ))
        )}
      </div>

      {!isPending && tickets.length > 0 && (
        <p className="mt-4 px-5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-4">
          {tickets.length} shown
        </p>
      )}
    </>
  );
}

function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const triaging = isTriagingStatus(ticket.status as TicketStatus);
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-[var(--r-lg)] border border-border bg-card px-[15px] py-3.5 text-left transition-colors hover:bg-panel-2"
    >
      <div className="truncate text-[14.5px] font-medium text-foreground tracking-[-0.005em]">
        {ticket.subject}
      </div>
      <div className="mt-1 font-mono text-[11px] text-ink-4">
        #{formatCaseId(ticket.id)} · {ticket.fromName}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {triaging ? (
          <span className="ai-chip text-[10px]">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Classifying
          </span>
        ) : (
          <StatusPill status={ticket.status as TicketStatus} />
        )}
        <CardPriority priority={ticket.priority} />
        {!triaging && ticket.category && (
          <span className={`${BADGE_BASE} ${CATEGORY_BADGE}`}>
            {CATEGORY_LABELS[ticket.category]}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5">
          <SlaBadge ticket={ticket} />
          <span className="font-mono text-[11px] text-ink-4">
            {formatRelative(ticket.createdAt)}
          </span>
        </span>
      </div>
    </button>
  );
}

function CardPriority({ priority }: { priority: TicketPriority }) {
  if (priority === TicketPriority.low || priority === TicketPriority.normal) return null;
  return (
    <span className={`${BADGE_BASE} ${PRIORITY_STYLES[priority]}`}>
      <span className={`size-1.5 rounded-full ${PRIORITY_DOT[priority]}`} aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
