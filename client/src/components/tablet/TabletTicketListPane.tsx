import type { Ticket, TicketStatus } from "@helpdesk/core";
import { TicketPriority, type TicketView } from "@helpdesk/core";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import ScopeToggle from "@/components/ScopeToggle";
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
import { cn } from "@/lib/utils";

// Generous page size so the side list shows a full working set without
// pagination chrome; the footer surfaces the total so nothing is silently
// dropped beyond this cap.
const LIST_SIZE = 50;

interface Props {
  scope: "all" | "mine";
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export default function TabletTicketListPane({ scope, selectedId, onSelect }: Props) {
  const [view, setView] = useState<TicketView | null>(null);
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const isArchive = scope === "all" && archived;

  const { data, isPending, isError } = useTickets({
    sortBy: "createdAt",
    sortOrder: "desc",
    status: "",
    category: "",
    priority: "",
    // "mine" lists tickets assigned to the current agent; the server ignores
    // view presets when assignee is set, so the view chips are all-scope only.
    assignee: scope === "mine" ? "me" : "",
    search: debouncedSearch,
    breachedOnly: false,
    slaState: "",
    view: scope === "all" && !isArchive ? view : null,
    archived: isArchive,
    page: 1,
    pageSize: LIST_SIZE,
  });

  const tickets = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex h-full w-[384px] flex-none flex-col border-r border-border bg-background">
      <div className="flex-none border-b border-border px-5 pt-[22px] pb-3.5">
        <p className="eyebrow mb-2">{scope === "mine" ? "Assigned to me" : "Queue"}</p>
        <h1 className="display-serif mb-4 text-[30px] text-foreground">
          {scope === "mine" ? "My tickets" : "Tickets"}
        </h1>
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
        {scope === "all" && (
          <div className="mt-3">
            <ScopeToggle
              archived={archived}
              onChange={(next) => {
                setArchived(next);
                if (next) setView(null);
              }}
            />
          </div>
        )}
        {scope === "all" && !isArchive && (
          <div className="mt-3">
            <TicketViewChips activeView={view} onChange={setView} />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <p className="px-5 py-10 text-center text-[13px] text-ros-fg">
            Failed to load tickets.
          </p>
        ) : isPending ? (
          <ListSkeleton />
        ) : tickets.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="display-serif text-[19px] text-ink-2">
              {isArchive ? "Nothing archived" : "Nothing here."}
            </p>
            <p className="mt-1.5 text-[13.5px] text-ink-3">
              {isArchive ? "Closed tickets show up here." : "Try another view or search."}
            </p>
          </div>
        ) : (
          <ul>
            {tickets.map((t) => (
              <li key={t.id}>
                <TicketCard
                  ticket={t}
                  selected={selectedId === String(t.id)}
                  onClick={() => onSelect(String(t.id))}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-none border-t border-border px-5 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-4">
          {tickets.length} shown
          {total > tickets.length ? ` of ${total}` : ""}
        </span>
      </div>
    </div>
  );
}

function TicketCard({
  ticket,
  selected,
  onClick,
}: {
  ticket: Ticket;
  selected: boolean;
  onClick: () => void;
}) {
  const triaging = isTriagingStatus(ticket.status as TicketStatus);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "block w-full border-b border-l-[3px] border-border px-4 py-3.5 text-left transition-colors",
        selected
          ? "border-l-primary bg-accent-tint"
          : "border-l-transparent hover:bg-panel-2",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground tracking-[-0.005em]">
          {ticket.subject}
        </span>
        <span className="flex-none font-mono text-[10.5px] text-ink-4">
          {formatRelative(ticket.createdAt)}
        </span>
      </div>
      <p className="mb-2.5 truncate font-mono text-[11px] text-ink-4">
        #{formatCaseId(ticket.id)} · {ticket.fromName}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={ticket.status as TicketStatus} />
        {triaging ? (
          <span className="ai-chip">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Classifying
          </span>
        ) : ticket.category ? (
          <span className={`${BADGE_BASE} ${CATEGORY_BADGE}`}>
            {CATEGORY_LABELS[ticket.category]}
          </span>
        ) : null}
        <CardPriority priority={ticket.priority} />
        <span className="ml-auto">
          <SlaBadge ticket={ticket} />
        </span>
      </div>
    </button>
  );
}

// Low/Normal stay quiet (no chip); High/Urgent earn a colored pill — mirrors the
// queue table's PriorityCell so the two surfaces read identically.
function CardPriority({ priority }: { priority: TicketPriority }) {
  if (priority === TicketPriority.low || priority === TicketPriority.normal) return null;
  return (
    <span className={`${BADGE_BASE} ${PRIORITY_STYLES[priority]}`}>
      <span className={`size-1.5 rounded-full ${PRIORITY_DOT[priority]}`} aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function ListSkeleton() {
  return (
    <ul aria-label="Loading tickets">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder; never reorders
          key={`tablet-list-skeleton-${i}`}
          className="border-b border-border px-4 py-3.5"
        >
          <div className="mb-2 h-3.5 w-3/4 rounded bg-panel-2" />
          <div className="mb-2.5 h-2.5 w-1/3 rounded bg-panel-2" />
          <div className="h-4 w-24 rounded-full bg-panel-2" />
        </li>
      ))}
    </ul>
  );
}
