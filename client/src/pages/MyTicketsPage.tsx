import { useState } from "react";
import MyTicketsSection from "@/components/MyTicketsSection";
import MobileTicketsList from "@/components/mobile/MobileTicketsList";
import TabletTicketsMasterDetail from "@/components/tablet/TabletTicketsMasterDetail";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import { useLayoutTier } from "@/lib/useBreakpoint";

export default function MyTicketsPage() {
  const tier = useLayoutTier();
  if (tier === "mobile") return <MobileTicketsList scope="mine" />;
  if (tier === "tablet") return <MyTicketsMasterDetail />;
  return <MyTicketsList />;
}

// Tablet: the personal queue as a two-pane master-detail. Selection is local
// (not URL) — `/my-tickets` has no detail route, and this is a focused work
// surface rather than a deep-linkable queue.
function MyTicketsMasterDetail() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  return (
    <TabletTicketsMasterDetail
      scope="mine"
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  );
}

function MyTicketsList() {
  return (
    <PageContainer width="list">
      <PageHeader
        title="My tickets"
        description="Tickets assigned to you — what you're working on now, and what you've already solved."
      />

      <MyTicketsSection title="Active" scope="active" />
      <MyTicketsSection title="Closed" scope="closed" />
    </PageContainer>
  );
}
