import MyTicketsSection from "@/components/MyTicketsSection";
import PageHeader from "@/components/ui/PageHeader";

export default function MyTicketsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6 md:px-8 md:pt-12 md:pb-16 lg:px-10 xl:px-12 xl:pt-16 2xl:px-16 2xl:pt-20">
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
