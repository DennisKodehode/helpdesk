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
import { type Ticket } from "@helpdesk/core";
import { Skeleton } from "@/components/ui/skeleton";
import { BADGE_BASE, STATUS_STYLES, CATEGORY_LABELS } from "@/lib/ticket-ui";

interface TicketsTableProps {
  tickets: Ticket[];
  isPending: boolean;
  isError: boolean;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
}


const columns: ColumnDef<Ticket>[] = [
  {
    id: "subject",
    accessorKey: "subject",
    header: "Subject",
    cell: ({ row }) => (
      <Link
        to={`/tickets/${row.original.id}`}
        className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline block max-w-xs truncate"
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
      <div>
        <p className="text-sm font-medium text-gray-900">{row.original.fromName}</p>
        <p className="text-xs text-gray-500">{row.original.fromEmail}</p>
      </div>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className={`${BADGE_BASE} ${STATUS_STYLES[row.original.status]}`}>
        {row.original.status}
      </span>
    ),
  },
  {
    id: "category",
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) =>
      row.original.category ? (
        <span className={`${BADGE_BASE} bg-blue-100 text-blue-700`}>
          {CATEGORY_LABELS[row.original.category]}
        </span>
      ) : (
        <span className="text-sm text-gray-400">—</span>
      ),
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: "Received",
    cell: ({ row }) => (
      <span className="text-sm text-gray-500">
        {new Date(row.original.createdAt).toLocaleDateString()}
      </span>
    ),
  },
];

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ChevronUp className="inline-block ml-1 size-3" />;
  if (isSorted === "desc") return <ChevronDown className="inline-block ml-1 size-3" />;
  return <ChevronsUpDown className="inline-block ml-1 size-3 text-gray-300" />;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={`skeleton-${i}`}>
          <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
          <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded" /></td>
          <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
        </tr>
      ))}
    </>
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

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  <SortIcon isSorted={header.column.getIsSorted()} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {isPending ? (
            <SkeletonRows />
          ) : tickets.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                No tickets yet
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
