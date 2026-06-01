import MyTicketsSection from "@/components/MyTicketsSection";
import PageHeader from "@/components/ui/PageHeader";

export default function MyTicketsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 pt-11 pb-10 sm:px-6 md:px-8 md:pb-12 lg:px-12 xl:px-14">
      <PageHeader
        eyebrow="Personal"
        title="My tickets"
        description="Tickets assigned to you — what you're working on now, and what you've already solved."
      />

      <MyTicketsSection title="Active" scope="active" />
      <MyTicketsSection title="Closed" scope="closed" />
    </main>
  );
}
