import { UserStatus } from "@helpdesk/core";
import { BADGE_BASE } from "@/lib/ticket-ui";

const META: Record<UserStatus, { label: string; styles: string; dot: string }> = {
  [UserStatus.active]: {
    label: "Active",
    styles: "bg-eme-bg text-eme-fg border-eme-dot/30",
    dot: "bg-eme-dot",
  },
  [UserStatus.invited]: {
    label: "Invited",
    styles: "bg-amb-bg text-amb-fg border-amb-dot/30",
    dot: "bg-amb-dot",
  },
  [UserStatus.inactive]: {
    label: "Inactive",
    styles: "bg-zin-bg text-zin-fg border-zin-dot/30",
    dot: "bg-zin-dot",
  },
};

export default function AgentStatusPill({ status }: { status: UserStatus }) {
  const m = META[status];
  return (
    <span className={`${BADGE_BASE} ${m.styles}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}
