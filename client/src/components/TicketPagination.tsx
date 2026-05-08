interface Props {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}

export default function TicketPagination({
  page,
  totalPages,
  start,
  end,
  total,
  onPrevious,
  onNext,
}: Props) {
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-gray-500">
        {total > 0 ? `${start}–${end} of ${total}` : ""}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={onPrevious}
          disabled={page === 1}
          aria-label="Previous page"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-gray-700">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
