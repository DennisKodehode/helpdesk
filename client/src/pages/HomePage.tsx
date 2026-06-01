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
    <main className="mx-auto max-w-[1320px] px-4 pt-11 pb-10 sm:px-6 md:px-8 md:pb-12 lg:px-12 xl:px-14">
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

      {/* Row 2 — AI + activity (left), attention + composition + SLA (right).
          Prototype uses a tight 16px rhythm throughout the dashboard. The
          two-column split holds from `md` up (matching the prototype's fixed,
          non-collapsing grid) so the dashboard stays compact on the ~900–1024px
          effective widths common on scaled Windows displays — collapsing to a
          single column only on true mobile/tablet-portrait below 768px. */}
      <div className="mt-4 grid gap-4 md:grid-cols-[1.55fr_1fr] md:items-start">
        <div className="space-y-4">
          <AiThisWeekCard />
          <RecentActivityCard />
        </div>
        <div className="space-y-4">
          <NeedsAttentionCard />
          <CategoryBreakdownCard />
          <SlaRingsCard />
        </div>
      </div>
    </main>
  );
}
