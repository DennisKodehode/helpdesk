import { type Role, type RosterAgent, UserStatus } from "@helpdesk/core";
import AgentRoleMenu from "@/components/AgentRoleMenu";
import AgentRowMenu, { type AgentRowAction } from "@/components/AgentRowMenu";
import AgentStatusPill from "@/components/AgentStatusPill";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDurationShort, formatRelative } from "@/lib/ticket-ui";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avgLabel(minutes: number | null): string {
  return minutes == null ? "—" : formatDurationShort(minutes);
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-[38px] shrink-0 place-items-center rounded-full bg-panel-2 font-mono text-[12px] font-medium text-ink-2"
    >
      {initials(name)}
    </span>
  );
}

interface Props {
  roster: RosterAgent[];
  isPending: boolean;
  isError: boolean;
  onRoleChange: (id: string, role: Role) => void;
  onAction: (id: string, action: AgentRowAction) => void;
  emptyTitle?: string;
}

const NUM = "px-4 py-[15px] text-right font-mono tabular text-[14px]";

export default function RosterTable({
  roster,
  isPending,
  isError,
  onRoleChange,
  onAction,
  emptyTitle = "No one matches this view.",
}: Props) {
  if (isError) return <ErrorAlert message="Failed to load the team roster" />;

  return (
    <>
      {/* Desktop table — lg+ */}
      <div className="hidden overflow-x-auto rounded-[var(--r-lg)] border border-border bg-card lg:block">
        <table className="min-w-[880px] w-full border-collapse">
          <thead>
            <tr className="hairline-b bg-panel-2">
              {["Agent", "Role", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground first:pl-[18px]"
                >
                  {h}
                </th>
              ))}
              {["Open", "Resolved · 30d", "Avg. resolution"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Last active
              </th>
              <th className="w-[52px]" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                <tr key={i} className="hairline-b">
                  <td className="px-4 py-[15px] pl-[18px]">
                    <Skeleton className="h-9 w-48" />
                  </td>
                  {Array.from({ length: 7 }).map((__, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                    <td key={j} className="px-4 py-[15px]">
                      <Skeleton className="h-4 w-16" />
                    </td>
                  ))}
                </tr>
              ))
            ) : roster.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center">
                  <p className="display-serif text-2xl text-muted-foreground">
                    {emptyTitle}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground/70">
                    Try clearing a filter.
                  </p>
                </td>
              </tr>
            ) : (
              roster.map((a) => {
                const dim = a.status !== UserStatus.active;
                return (
                  <tr
                    key={a.id}
                    className="hairline-b transition-colors hover:bg-panel-2"
                  >
                    <td
                      className={`px-4 py-[15px] pl-[18px] ${dim ? "opacity-[0.62]" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={a.name} />
                        <div className="min-w-0">
                          <div className="text-[14.5px] font-semibold text-foreground">
                            {a.name}
                          </div>
                          <div className="truncate font-mono text-[11.5px] text-ink-4">
                            {a.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-[15px]">
                      <AgentRoleMenu
                        role={a.role}
                        onChange={(role) => onRoleChange(a.id, role)}
                      />
                    </td>
                    <td className="px-4 py-[15px]">
                      <AgentStatusPill status={a.status} />
                    </td>
                    <td
                      className={`${NUM} ${a.openAssigned ? "text-foreground" : "text-ink-4"}`}
                    >
                      {a.openAssigned}
                    </td>
                    <td className={`${NUM} text-ink-2`}>{a.resolved30d}</td>
                    <td className={`${NUM} text-[13px] text-ink-3`}>
                      {avgLabel(a.avgResolutionMinutes)}
                    </td>
                    <td className="px-4 py-[15px] font-mono text-[12px] whitespace-nowrap text-ink-3">
                      {a.lastActiveAt ? formatRelative(a.lastActiveAt) : "—"}
                    </td>
                    <td className="px-4 py-[15px] text-right">
                      <AgentRowMenu
                        status={a.status}
                        onAction={(action) => onAction(a.id, action)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — below lg */}
      <ul className="space-y-2 lg:hidden">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            <li key={i}>
              <Skeleton className="h-24 w-full rounded-[var(--r-lg)]" />
            </li>
          ))
        ) : roster.length === 0 ? (
          <li className="rounded-[var(--r-lg)] border border-border bg-card p-8 text-center">
            <p className="display-serif text-2xl text-muted-foreground">{emptyTitle}</p>
          </li>
        ) : (
          roster.map((a) => (
            <li
              key={a.id}
              className={`rounded-[var(--r-lg)] border border-border bg-card p-4 ${
                a.status !== UserStatus.active ? "opacity-[0.62]" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={a.name} />
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-semibold text-foreground">
                      {a.name}
                    </div>
                    <div className="truncate font-mono text-[11.5px] text-ink-4">
                      {a.email}
                    </div>
                  </div>
                </div>
                <AgentRowMenu
                  status={a.status}
                  onAction={(action) => onAction(a.id, action)}
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <AgentRoleMenu
                  role={a.role}
                  onChange={(role) => onRoleChange(a.id, role)}
                />
                <AgentStatusPill status={a.status} />
              </div>
              <div className="mt-3 flex gap-5 font-mono text-[12px] text-ink-3">
                <span>{a.openAssigned} open</span>
                <span>{a.resolved30d} resolved·30d</span>
                <span>{avgLabel(a.avgResolutionMinutes)}</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </>
  );
}
