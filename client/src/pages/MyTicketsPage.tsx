import MyTicketsSection from "@/components/MyTicketsSection";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";

export default function MyTicketsPage() {
  return (
    <PageContainer width="list">
      <PageHeader
        eyebrow="Personal"
        title="My tickets"
        description="Tickets assigned to you — what you're working on now, and what you've already solved."
      />

      <MyTicketsSection title="Active" scope="active" />
      <MyTicketsSection title="Closed" scope="closed" />
    </PageContainer>
  );
}
