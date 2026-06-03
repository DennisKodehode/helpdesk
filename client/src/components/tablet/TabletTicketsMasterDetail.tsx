import TabletTicketDetailPane from "./TabletTicketDetailPane";
import TabletTicketListPane from "./TabletTicketListPane";

interface Props {
  scope: "all" | "mine";
  /** The selected ticket id (URL `:id` for the all scope, local state for mine). */
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

/**
 * Tablet Tickets: a two-pane master-detail — filterable list on the left, the
 * live ticket detail on the right. Selection is controlled by the caller so the
 * all-tickets queue can sync it to the `/tickets/:id` URL (deep-linkable) while
 * the personal queue keeps it in local state.
 */
export default function TabletTicketsMasterDetail({
  scope,
  selectedId,
  onSelect,
}: Props) {
  return (
    <div className="flex h-full min-w-0">
      <TabletTicketListPane scope={scope} selectedId={selectedId} onSelect={onSelect} />
      {selectedId ? (
        <TabletTicketDetailPane id={selectedId} />
      ) : (
        <div className="grid min-w-0 flex-1 place-items-center bg-background">
          <div className="text-center">
            <p className="display-serif text-[24px] text-ink-2">Select a ticket</p>
            <p className="mt-2 text-[14px] text-ink-3">
              Pick a conversation from the queue to view it here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
