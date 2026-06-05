import { hasAdminAccess, Role } from "@helpdesk/core";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BADGE_BASE, ROLE_BADGE, ROLE_LABEL } from "@/lib/ticket-ui";

interface Props {
  role: Role;
  onChange: (role: Role) => void;
  // Render a static badge with no dropdown — used when the viewer isn't allowed
  // to change this row's role (regular admins, or any view of the global admin).
  readOnly?: boolean;
}

export default function AgentRoleMenu({ role, onChange, readOnly }: Props) {
  const showShield = hasAdminAccess(role);

  if (readOnly) {
    return (
      <span className={`${BADGE_BASE} ${ROLE_BADGE[role]}`}>
        {showShield && <ShieldCheck className="size-3" aria-hidden />}
        {ROLE_LABEL[role]}
      </span>
    );
  }

  // Interactive menu only ever toggles agent ⇄ admin (globalAdmin is
  // programmatic-only and always read-only above).
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change role"
        className={`${BADGE_BASE} cursor-pointer pr-1.5 outline-none ${ROLE_BADGE[role]}`}
      >
        {showShield && <ShieldCheck className="size-3" aria-hidden />}
        {ROLE_LABEL[role]}
        <ChevronDown className="size-3 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {[Role.agent, Role.admin].map((r) => (
          <DropdownMenuItem
            key={r}
            onClick={() => {
              if (r !== role) onChange(r);
            }}
          >
            <span className="flex w-4 justify-center text-accent-ink">
              {r === role && <Check className="size-3.5" aria-hidden />}
            </span>
            {r === Role.admin ? (
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" aria-hidden /> Admin
              </span>
            ) : (
              "Agent"
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
