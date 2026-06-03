import type { Ticket } from "@helpdesk/core";
import { TicketPriority, type TicketStatus } from "@helpdesk/core";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronsUpDown, ChevronUp, Loader2 } from "lucide-react";
import { SlaBadge } from "@/components/SlaBadge";
import StatusPill from "@/components/StatusPill";
import SuppressionPill from "@/components/SuppressionPill";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Link } from "@/components/ui/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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

const SLA_DASH = <span className="text-ink-4">—</span>;

// Category cell: while the ticket is triaging the AI is still classifying it,
// so show a violet "Classifying" spinner instead of a (not-yet-known) category.
function CategoryCell({ ticket }: { ticket: Ticket }) {
  if (isTriagingStatus(ticket.status as TicketStatus)) {
    return (
      <span className="ai-chip">
        <Loader2 className="size-3 animate-spin" aria-hidden /> Classifying
      </span>
    );
  }
  if (!ticket.category) return <span className="text-sm text-ink-4">—</span>;
  return (
    <span className={`${BADGE_BASE} ${CATEGORY_BADGE}`}>
      {CATEGORY_LABELS[ticket.category]}
    </span>
  );
}

interface TicketsTableProps {
  tickets: Ticket[];
  isPending: boolean;
  isError: boolean;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  emptyTitle?: string;
  emptyDescription?: string;
}

// Responsive column visibility. The table only shows at lg+ — below that we
// render the mobile card list. Within the table, secondary columns hide on
// narrower breakpoints so the essentials (Subject, Status, Priority, Received)
// always fit without horizontal clipping. ColumnMeta carries the per-column
// breakpoint class so headers + cells stay in sync.
type ColumnMeta = { cellClass?: string };

// Priority stays restrained: Low/Normal render as muted mono text (no pill,
// no dot) so the queue doesn't light up; only High (orange) and Urgent (rose)
// earn a colored pill. Shared by the desktop cell and the mobile card.
function PriorityCell({ priority }: { priority: TicketPriority }) {
  if (priority === TicketPriority.low || priority === TicketPriority.normal) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.07em] text-ink-4">
        {PRIORITY_LABELS[priority]}
      </span>
    );
  }
  return (
    <span className={`${BADGE_BASE} ${PRIORITY_STYLES[priority]}`}>
      <span className={`size-1.5 rounded-full ${PRIORITY_DOT[priority]}`} aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const columns: ColumnDef<Ticket, unknown>[] = [
  {
    id: "subject",
    accessorKey: "subject",
    header: "Subject",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          to={`/tickets/${row.original.id}`}
          className="block max-w-[11rem] truncate text-[14.5px] font-medium text-foreground underline-offset-4 hover:underline qcols:max-w-[20rem]"
        >
          {row.original.subject}
        </Link>
        <p className="mt-0.5 font-mono tabular text-[11px] text-ink-4">
          #{formatCaseId(row.original.id)}
        </p>
      </div>
    ),
  },
  {
    id: "fromName",
    accessorKey: "fromName",
    header: "From",
    meta: { cellClass: "hidden xl:table-cell" } as ColumnMeta,
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[8rem] qcols:max-w-[12rem]">
        <p className="truncate text-[13px] text-foreground">{row.original.fromName}</p>
        <div className="flex items-center gap-2">
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {row.original.fromEmail}
          </p>
          {row.original.isSuppressed && <SuppressionPill />}
        </div>
      </div>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill status={row.original.status as TicketStatus} />,
  },
  {
    id: "category",
    accessorKey: "category",
    header: "Category",
    meta: { cellClass: "hidden xl:table-cell" } as ColumnMeta,
    cell: ({ row }) => <CategoryCell ticket={row.original} />,
  },
  {
    id: "priority",
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => (
      <PriorityCell priority={row.original.priority as TicketPriority} />
    ),
  },
  {
    id: "sla",
    header: "SLA",
    enableSorting: false,
    meta: { cellClass: "hidden xl:table-cell" } as ColumnMeta,
    cell: ({ row }) => <SlaBadge ticket={row.original} fallback={SLA_DASH} />,
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: "Received",
    cell: ({ row }) => (
      <span className="font-mono tabular text-[12px] text-muted-foreground">
        {formatRelative(row.original.createdAt)}
      </span>
    ),
  },
];

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ChevronUp className="inline-block ml-1 size-3" />;
  if (isSorted === "desc") return <ChevronDown className="inline-block ml-1 size-3" />;
  return <ChevronsUpDown className="inline-block ml-1 size-3 text-muted-foreground/30" />;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder; never reorders
        <tr key={`skeleton-${i}`} className="hairline-b">
          <td className="px-4 py-[15px]">
            <Skeleton className="h-3.5 w-56" />
          </td>
          <td className="hidden xl:table-cell px-4 py-[15px]">
            <Skeleton className="h-3.5 w-36" />
          </td>
          <td className="px-4 py-[15px]">
            <Skeleton className="h-5 w-20 rounded-full" />
          </td>
          <td className="hidden xl:table-cell px-4 py-[15px]">
            <Skeleton className="h-5 w-20 rounded-full" />
          </td>
          <td className="px-4 py-[15px]">
            <Skeleton className="h-5 w-20 rounded-full" />
          </td>
          <td className="hidden xl:table-cell px-4 py-[15px]">
            <Skeleton className="h-5 w-20 rounded-full" />
          </td>
          <td className="px-4 py-[15px]">
            <Skeleton className="h-3.5 w-20" />
          </td>
        </tr>
      ))}
    </>
  );
}

function MobileSkeleton() {
  return (
    <ul className="space-y-2" aria-label="Loading tickets">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder; never reorders
          key={`mobile-skeleton-${i}`}
          className="h-32 rounded-[var(--r-lg)] border border-border bg-card"
        >
          <div className="flex items-start justify-between p-4">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="px-4 pb-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MobileEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[var(--r-lg)] border border-border bg-card p-8 text-center">
      <p className="display-serif text-2xl text-muted-foreground">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground/70">{description}</p>
    </div>
  );
}

export default function TicketsTable({
  tickets,
  isPending,
  isError,
  sorting,
  onSortingChange,
  emptyTitle = "No tickets yet",
  emptyDescription = "When customers email in, they'll appear here.",
}: TicketsTableProps) {
  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting },
    onSortingChange,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isError) {
    return <ErrorAlert message="Failed to load tickets" />;
  }

  const currentSort = sorting[0];
  const mobileSortValue =
    currentSort?.id === "createdAt" && currentSort.desc === false ? "oldest" : "newest";

  function handleMobileSortChange(value: string | null) {
    if (value === null) return;
    onSortingChange([{ id: "createdAt", desc: value === "newest" }]);
  }

  return (
    <>
      {/* Desktop table — lg+ only. Below lg the mobile card list takes over.
          Subject is capped at 22rem and From at 14rem so the table always
          fits its content area at every breakpoint — overflow-hidden keeps
          the rounded card aesthetic clean (no inner scrollbar). */}
      <div className="hidden overflow-hidden rounded-[var(--r-lg)] border border-border bg-card lg:block">
        <table className="min-w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="hairline-b bg-panel-2">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                  return (
                    <th
                      key={header.id}
                      className={`cursor-pointer select-none px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground ${meta?.cellClass ?? ""}`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon isSorted={header.column.getIsSorted()} />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isPending ? (
              <SkeletonRows />
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <p className="display-serif text-2xl text-muted-foreground">
                    {emptyTitle}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground/70">
                    {emptyDescription}
                  </p>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx, arr) => (
                <tr
                  key={row.id}
                  className={`group transition-colors hover:bg-panel-2 ${
                    idx < arr.length - 1 ? "hairline-b" : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                    return (
                      <td
                        key={cell.id}
                        className={`px-4 py-[15px] align-middle ${meta?.cellClass ?? ""}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile + tablet card list — anything below lg. The cards already
          include status, subject, priority, category, received and the
          suppression pill — they read better than a cramped table here. */}
      <div className="lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Sort
          </p>
          <Select value={mobileSortValue} onValueChange={handleMobileSortChange}>
            <SelectTrigger aria-label="Sort tickets" size="sm" className="h-9 w-36">
              <SelectValue>
                {(v: string | null) => (v === "oldest" ? "Oldest first" : "Newest first")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isPending ? (
          <MobileSkeleton />
        ) : tickets.length === 0 ? (
          <MobileEmpty title={emptyTitle} description={emptyDescription} />
        ) : (
          <ul className="space-y-2" aria-label="Tickets">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="relative rounded-[var(--r-lg)] border border-border bg-card transition-colors hover:bg-panel-2 focus-within:ring-2 focus-within:ring-ring"
              >
                <div className="flex items-start justify-between gap-3 px-4 pt-4">
                  <span className="font-mono tabular text-[11px] text-muted-foreground">
                    #{formatCaseId(t.id)}
                  </span>
                  <StatusPill status={t.status as TicketStatus} />
                </div>
                <div className="px-4 pt-2">
                  <Link
                    to={`/tickets/${t.id}`}
                    className="block text-[14px] font-medium text-foreground line-clamp-2 before:absolute before:inset-0 before:rounded-lg before:content-[''] focus-visible:outline-none"
                  >
                    {t.subject}
                  </Link>
                </div>
                <div className="flex items-end justify-between gap-3 px-4 pt-3 pb-4">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] text-foreground">{t.fromName}</p>
                    <div className="flex items-center gap-2">
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {t.fromEmail}
                      </p>
                      {t.isSuppressed && <SuppressionPill />}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="relative z-10">
                      <PriorityCell priority={t.priority as TicketPriority} />
                    </span>
                    <span className="relative z-10">
                      <SlaBadge ticket={t} />
                    </span>
                    <span className="relative z-10">
                      <CategoryCell ticket={t} />
                    </span>
                    <span className="font-mono tabular text-[11px] text-muted-foreground">
                      {formatRelative(t.createdAt)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
