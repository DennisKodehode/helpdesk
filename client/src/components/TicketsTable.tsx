import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Link } from "@/components/ui/link";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { type Ticket, TicketStatus } from "@helpdesk/core";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BADGE_BASE,
  CATEGORY_LABELS,
  CATEGORY_BADGE,
  formatRelative,
} from "@/lib/ticket-ui";
import StatusPill from "@/components/StatusPill";

interface TicketsTableProps {
  tickets: Ticket[];
  isPending: boolean;
  isError: boolean;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
}

const columns: ColumnDef<Ticket>[] = [
  {
    id: "id",
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <span className="font-mono tabular text-[12px] text-muted-foreground">
        #{String(row.original.id).padStart(4, "0")}
      </span>
    ),
  },
  {
    id: "subject",
    accessorKey: "subject",
    header: "Subject",
    cell: ({ row }) => (
      <Link
        to={`/tickets/${row.original.id}`}
        className="block max-w-md truncate text-[13.5px] font-medium text-foreground underline-offset-4 hover:underline xl:max-w-xl 2xl:max-w-2xl"
      >
        {row.original.subject}
      </Link>
    ),
  },
  {
    id: "fromName",
    accessorKey: "fromName",
    header: "From",
    cell: ({ row }) => (
      <div className="min-w-0 lg:max-w-[18rem] xl:max-w-[22rem]">
        <p className="truncate text-[13px] text-foreground">{row.original.fromName}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {row.original.fromEmail}
        </p>
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
    cell: ({ row }) =>
      row.original.category ? (
        <span className={`${BADGE_BASE} ${CATEGORY_BADGE}`}>
          {CATEGORY_LABELS[row.original.category]}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground/40">—</span>
      ),
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
  return (
    <ChevronsUpDown className="inline-block ml-1 size-3 text-muted-foreground/30" />
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={`skeleton-${i}`} className="hairline-b">
          <td className="px-5 py-3.5"><Skeleton className="h-3.5 w-12" /></td>
          <td className="px-5 py-3.5"><Skeleton className="h-3.5 w-56" /></td>
          <td className="px-5 py-3.5"><Skeleton className="h-3.5 w-36" /></td>
          <td className="px-5 py-3.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
          <td className="px-5 py-3.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
          <td className="px-5 py-3.5"><Skeleton className="h-3.5 w-20" /></td>
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
          key={`mobile-skeleton-${i}`}
          className="h-32 rounded-lg border border-border bg-card"
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

function MobileEmpty() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <p className="display-serif text-2xl text-muted-foreground">No tickets yet</p>
      <p className="mt-1 text-[13px] text-muted-foreground/70">
        When customers email in, they'll appear here.
      </p>
    </div>
  );
}

export default function TicketsTable({
  tickets,
  isPending,
  isError,
  sorting,
  onSortingChange,
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
    currentSort?.id === "createdAt" && currentSort.desc === false
      ? "oldest"
      : "newest";

  function handleMobileSortChange(value: string | null) {
    if (value === null) return;
    onSortingChange([{ id: "createdAt", desc: value === "newest" }]);
  }

  return (
    <>
      {/* Desktop: full table */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <table className="min-w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="hairline-b">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer select-none px-5 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <SortIcon isSorted={header.column.getIsSorted()} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isPending ? (
              <SkeletonRows />
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center">
                  <p className="display-serif text-2xl text-muted-foreground">No tickets yet</p>
                  <p className="mt-1 text-[13px] text-muted-foreground/70">
                    When customers email in, they'll appear here.
                  </p>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx, arr) => (
                <tr
                  key={row.id}
                  className={`group transition-colors hover:bg-accent/40 ${
                    idx < arr.length - 1 ? "hairline-b" : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-3.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: sort + card list */}
      <div className="md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Sort
          </p>
          <Select value={mobileSortValue} onValueChange={handleMobileSortChange}>
            <SelectTrigger
              aria-label="Sort tickets"
              size="sm"
              className="h-9 w-36"
            >
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
          <MobileEmpty />
        ) : (
          <ul className="space-y-2" aria-label="Tickets">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="relative rounded-lg border border-border bg-card transition-colors hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring"
              >
                <div className="flex items-start justify-between gap-3 px-4 pt-4">
                  <span className="font-mono tabular text-[11px] text-muted-foreground">
                    #{String(t.id).padStart(4, "0")}
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
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {t.fromEmail}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {t.category && (
                      <span
                        className={`${BADGE_BASE} ${CATEGORY_BADGE} relative z-10`}
                      >
                        {CATEGORY_LABELS[t.category]}
                      </span>
                    )}
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
