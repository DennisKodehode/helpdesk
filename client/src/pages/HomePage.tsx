import { ArrowRight } from "lucide-react";
import CategoryBreakdownCard from "@/components/CategoryBreakdownCard";
import AiThisWeekCard from "@/components/dashboard/AiThisWeekCard";
import NeedsAttentionCard from "@/components/dashboard/NeedsAttentionCard";
import RecentActivityCard from "@/components/dashboard/RecentActivityCard";
import SlaRingsCard from "@/components/dashboard/SlaRingsCard";
import StatCards from "@/components/dashboard/StatCards";
import { Link } from "@/components/ui/link";
import PageHeader from "@/components/ui/PageHeader";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 md:px-8 md:pt-12 md:pb-16 lg:px-10 xl:px-12 xl:pt-16 2xl:px-16 2xl:pt-20">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Team workload, automation, and where attention is needed right now."
        action={
          <Link
            to="/tickets"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/85"
          >
            Open queue
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />

      {/* Row 1 — four stat cards */}
      <StatCards />

      {/* Row 2 — AI + activity (left), attention + composition + SLA (right) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <div className="space-y-6">
          <AiThisWeekCard />
          <RecentActivityCard />
        </div>
        <div className="space-y-6">
          <NeedsAttentionCard />
          <CategoryBreakdownCard />
          <SlaRingsCard />
        </div>
      </div>
    </main>
  );
}
