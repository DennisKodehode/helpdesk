import { UserStatus } from "@helpdesk/core";
import { Check, Mail, MoreHorizontal, Pause, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type AgentRowAction = "resend" | "deactivate" | "reactivate" | "remove";

interface Props {
  status: UserStatus;
  onAction: (action: AgentRowAction) => void;
  // Render the kebab greyed + inert with a tooltip — the viewer sees the control
  // but isn't allowed to act on this row (e.g. a regular admin on an admin row).
  disabled?: boolean;
  disabledTitle?: string;
}

export default function AgentRowMenu({
  status,
  onAction,
  disabled,
  disabledTitle,
}: Props) {
  if (disabled) {
    // Wrapper span carries the title — a native disabled button suppresses its own.
    return (
      <span title={disabledTitle} className="inline-flex">
        <button
          type="button"
          disabled
          aria-label="Agent actions"
          className="inline-flex size-9 cursor-not-allowed items-center justify-center rounded-[var(--r-sm)] text-ink-3 opacity-40"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Agent actions"
        className="inline-flex size-9 items-center justify-center rounded-[var(--r-sm)] text-ink-3 outline-none transition-colors hover:bg-panel-2 hover:text-foreground"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[196px]">
        {status === UserStatus.invited && (
          <DropdownMenuItem onClick={() => onAction("resend")}>
            <Mail className="size-3.5" aria-hidden /> Resend invite
          </DropdownMenuItem>
        )}
        {status === UserStatus.active && (
          <DropdownMenuItem onClick={() => onAction("deactivate")}>
            <Pause className="size-3.5" aria-hidden /> Deactivate
          </DropdownMenuItem>
        )}
        {status === UserStatus.inactive && (
          <DropdownMenuItem onClick={() => onAction("reactivate")}>
            <Check className="size-3.5" aria-hidden /> Reactivate
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAction("remove")} className="text-ros-fg">
          <X className="size-3.5" aria-hidden /> Remove from team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
