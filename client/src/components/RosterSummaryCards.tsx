import { Role, type RosterAgent, UserStatus } from "@helpdesk/core";

function AdminStat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="flex min-h-[116px] flex-col justify-between rounded-[var(--r-lg)] border border-border bg-card px-5 py-[18px]">
      <p className="eyebrow">{label}</p>
      <div>
        <span className="display-serif tabular text-[40px] leading-[0.9] text-foreground">
          {value}
        </span>
        <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-4">
          {sub}
        </p>
      </div>
    </div>
  );
}

export default function RosterSummaryCards({ roster }: { roster: RosterAgent[] }) {
  const members = roster.length;
  const admins = roster.filter((a) => a.role === Role.admin).length;
  const active = roster.filter((a) => a.status === UserStatus.active).length;
  const openAcross = roster.reduce((sum, a) => sum + a.openAssigned, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AdminStat label="Team members" value={members} sub="with workspace access" />
      <AdminStat label="Administrators" value={admins} sub="can manage settings" />
      <AdminStat label="Active" value={active} sub={`of ${members} members`} />
      <AdminStat label="Open · assigned" value={openAcross} sub="across the team" />
    </div>
  );
}
