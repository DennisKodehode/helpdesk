import { Role } from "@helpdesk/core";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BADGE_BASE } from "@/lib/ticket-ui";

interface Props {
  role: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}

export default function AgentRoleMenu({ role, onChange, disabled }: Props) {
  const isAdmin = role === Role.admin;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label="Change role"
        className={`${BADGE_BASE} cursor-pointer pr-1.5 outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          isAdmin
            ? "border-vio-dot/30 bg-vio-bg text-vio-fg"
            : "border-hairline-strong bg-transparent text-ink-2"
        }`}
      >
        {isAdmin && <ShieldCheck className="size-3" aria-hidden />}
        {isAdmin ? "Admin" : "Agent"}
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
