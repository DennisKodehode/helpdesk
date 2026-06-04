import type { AuditEventType } from "@helpdesk/core";
import { useSearchParams } from "react-router";
import ActivityFilters from "@/components/ActivityFilters";
import ActivityTable from "@/components/ActivityTable";
import HealthSignalsWatchlist from "@/components/HealthSignalsWatchlist";
import TicketPagination from "@/components/TicketPagination";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import { useRoster } from "@/lib/agents";
import { useAuditEvents } from "@/lib/audit-events";

function setParam(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

export default function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const type = searchParams.get("type") ?? "";
  const actorId = searchParams.get("actorId") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const { data: roster } = useRoster();
  const { data, isPending, isError } = useAuditEvents({ type, actorId, from, to, page });

  const events = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Changing any filter resets to page 1 (drop the param). Mirrors TicketsPage.
  function updateFilter(key: "type" | "actorId" | "from" | "to", value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      setParam(next, key, value);
      next.delete("page");
      return next;
    });
  }

  function setPageParam(nextPage: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextPage <= 1) next.delete("page");
      else next.set("page", String(nextPage));
      return next;
    });
  }

  return (
    <PageContainer width="content">
      <PageHeader
        eyebrow="Audit"
        title="Activity"
        description="Every action across all tickets — who did what, and when."
      />

      <HealthSignalsWatchlist
        currentType={type}
        onDrill={(t: AuditEventType) => updateFilter("type", t)}
      />

      <ActivityFilters
        type={type}
        actorId={actorId}
        from={from}
        to={to}
        actors={roster ?? []}
        onTypeChange={(v) => updateFilter("type", v)}
        onActorChange={(v) => updateFilter("actorId", v)}
        onFromChange={(v) => updateFilter("from", v)}
        onToChange={(v) => updateFilter("to", v)}
      />

      <ActivityTable events={events} isPending={isPending} isError={isError} />

      <TicketPagination
        page={page}
        totalPages={totalPages}
        start={start}
        end={end}
        total={total}
        onPrevious={() => setPageParam(page - 1)}
        onNext={() => setPageParam(page + 1)}
      />
    </PageContainer>
  );
}
