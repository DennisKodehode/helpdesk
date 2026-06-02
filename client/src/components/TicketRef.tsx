import { Link } from "@/components/ui/link";
import { formatCaseId } from "@/lib/ticket-ui";
import { cn } from "@/lib/utils";

// A standalone "#0042" link to a ticket. Use only where the case number is
// itself the link target — for a case number sitting inside a larger row link
// (e.g. NeedsAttentionCard, TicketsTable), render `formatCaseId(id)` as plain
// text instead to avoid nesting <a> inside <a>.
export function TicketRef({ id, className }: { id: number; className?: string }) {
  return (
    <Link
      to={`/tickets/${id}`}
      className={cn("font-mono text-accent-ink hover:underline", className)}
    >
      #{formatCaseId(id)}
    </Link>
  );
}
