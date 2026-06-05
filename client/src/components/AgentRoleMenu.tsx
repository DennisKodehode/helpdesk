import { Role } from "@helpdesk/core";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { RoleShield } from "@/components/RoleShield";
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
  // Static badge with no dropdown — the global-admin (owner) row, where the role
  // isn't an editable control for anyone.
  readOnly?: boolean;
  // Render the dropdown *look* but greyed + inert, with a tooltip — used when the
  // viewer can see the control a global admin has but isn't allowed to use it.
  disabled?: boolean;
  disabledTitle?: string;
}

export default function AgentRoleMenu({
  role,
  onChange,
  readOnly,
  disabled,
  disabledTitle,
}: Props) {
  if (readOnly) {
    return (
      <span className={`${BADGE_BASE} ${ROLE_BADGE[role]}`}>
        <RoleShield role={role} className="size-3" />
        {ROLE_LABEL[role]}
      </span>
    );
  }

  if (disabled) {
    // Wrapper span carries the title — a native disabled button suppresses its own.
    return (
      <span title={disabledTitle} className="inline-flex">
        <button
          type="button"
          disabled
          aria-label="Change role"
          className={`${BADGE_BASE} cursor-not-allowed pr-1.5 opacity-50 ${ROLE_BADGE[role]}`}
        >
          <RoleShield role={role} className="size-3" />
          {ROLE_LABEL[role]}
          <ChevronDown className="size-3 opacity-60" aria-hidden />
        </button>
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
        <RoleShield role={role} className="size-3" />
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
