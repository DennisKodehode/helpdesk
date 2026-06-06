import axios from "axios";
import { BookPlus, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSuggestTicketForKb } from "@/lib/kb";

// Files this resolved ticket as a pending KB suggestion for admin review. Shown
// in the ticket-detail sidebar once a ticket is resolved/closed — there's a
// resolution worth learning from. Any agent can file one; admins review it on
// the Knowledge base screen. `alreadySuggested` is the server-derived flag
// (ticket.hasKbSuggestion) so the confirmation persists across navigation and
// the ticket can't be suggested twice.
export default function SuggestForKbButton({
  ticketId,
  alreadySuggested,
}: {
  ticketId: number;
  alreadySuggested: boolean;
}) {
  const suggest = useSuggestTicketForKb();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    suggest.mutate(ticketId, {
      onSuccess: () => setDone(true),
      onError: (err) => {
        setError(
          axios.isAxiosError(err)
            ? (err.response?.data?.error ?? "Couldn't draft a suggestion.")
            : "Couldn't draft a suggestion.",
        );
      },
    });
  }

  if (alreadySuggested || done) {
    return (
      <p className="inline-flex items-center gap-1.5 text-[12.5px] text-eme-fg">
        <Check className="size-3.5" aria-hidden /> Sent for review
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={suggest.isPending}
      >
        <BookPlus className="size-4" aria-hidden />
        {suggest.isPending ? "Drafting…" : "Suggest for KB"}
      </Button>
      {error && <p className="text-[11px] text-ros-fg">{error}</p>}
    </div>
  );
}
