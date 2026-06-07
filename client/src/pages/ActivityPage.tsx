import { type AuditEventType, hasAdminAccess } from "@helpdesk/core";
import { useSearchParams } from "react-router";
import ActivityFilters from "@/components/ActivityFilters";
import ActivityTable from "@/components/ActivityTable";
import AdminActivityFilters from "@/components/AdminActivityFilters";
import AdminActivityTable from "@/components/AdminActivityTable";
import HealthSignalsWatchlist from "@/components/HealthSignalsWatchlist";
import TicketPagination from "@/components/TicketPagination";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import { useAdminAuditEvents } from "@/lib/admin-audit-events";
import { useRoster } from "@/lib/agents";
import { useAuditEvents } from "@/lib/audit-events";

function setParam(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

const TABS = [
  { key: "tickets", label: "Ticket activity" },
  { key: "admin", label: "Admin activity" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab: Tab = searchParams.get("tab") === "admin" ? "admin" : "tickets";
  const type = searchParams.get("type") ?? "";
  const actorId = searchParams.get("actorId") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const { data: roster } = useRoster();
  const filters = { type, actorId, from, to, page };
  // Only the active tab fetches (each hook is gated on `enabled`).
  const ticketsQuery = useAuditEvents(filters, tab === "tickets");
  const adminQuery = useAdminAuditEvents(filters, tab === "admin");

  const active = tab === "admin" ? adminQuery : ticketsQuery;
  const total = active.data?.total ?? 0;
  const pageSize = active.data?.pageSize ?? 25;
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

  // Reset every filter (type/actor/date range) and paging at once.
  function clearAllFilters() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("type");
      next.delete("actorId");
      next.delete("from");
      next.delete("to");
      next.delete("page");
      return next;
    });
  }

  // Switching tabs clears the type/actor filters (their option sets differ
  // between the two logs) and resets paging; date range carries over.
  function switchTab(next: Tab) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === "admin") p.set("tab", "admin");
      else p.delete("tab");
      p.delete("type");
      p.delete("actorId");
      p.delete("page");
      return p;
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
        title="Activity"
        description="Who did what, and when — across tickets and admin actions."
      />

      <div
        role="tablist"
        aria-label="Activity log"
        className="mb-5 inline-flex rounded-[var(--r-sm)] border border-border bg-panel-2 p-1"
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => switchTab(key)}
            className={`rounded-[6px] px-3 py-1.5 text-[13px] transition-colors ${
              tab === key
                ? "bg-card font-semibold text-foreground shadow-[var(--shadow-sm)]"
                : "text-ink-3 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tickets" ? (
        <>
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
            onClearAll={clearAllFilters}
          />
          <ActivityTable
            events={ticketsQuery.data?.data ?? []}
            isPending={ticketsQuery.isPending}
            isError={ticketsQuery.isError}
          />
        </>
      ) : (
        <>
          <AdminActivityFilters
            type={type}
            actorId={actorId}
            from={from}
            to={to}
            // Admin actions are only ever performed by admins/global admins, so
            // the actor filter only lists those — not every agent.
            actors={(roster ?? []).filter((a) => hasAdminAccess(a.role))}
            onTypeChange={(v) => updateFilter("type", v)}
            onActorChange={(v) => updateFilter("actorId", v)}
            onFromChange={(v) => updateFilter("from", v)}
            onToChange={(v) => updateFilter("to", v)}
            onClearAll={clearAllFilters}
          />
          <AdminActivityTable
            events={adminQuery.data?.data ?? []}
            isPending={adminQuery.isPending}
            isError={adminQuery.isError}
          />
        </>
      )}

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
