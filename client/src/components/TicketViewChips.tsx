import { TicketView } from "@helpdesk/core";
import { Hourglass, Sparkles, UserX } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

const VIEWS: ReadonlyArray<{
  key: TicketView;
  label: string;
  ariaLabel: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}> = [
  {
    key: TicketView.unassigned,
    label: "Unassigned",
    ariaLabel: "Show unassigned tickets",
    icon: UserX,
  },
  {
    key: TicketView.triage,
    label: "Needs triage",
    ariaLabel: "Show tickets that need triage",
    icon: Sparkles,
  },
  {
    key: TicketView.awaiting_customer,
    label: "Awaiting customer",
    ariaLabel: "Show open tickets awaiting a customer response",
    icon: Hourglass,
  },
];

interface Props {
  activeView: TicketView | null;
  onChange: (next: TicketView | null) => void;
}

export default function TicketViewChips({ activeView, onChange }: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {VIEWS.map(({ key, label, ariaLabel, icon: Icon }) => {
        const pressed = activeView === key;
        return (
          <Toggle
            key={key}
            aria-label={ariaLabel}
            variant="outline"
            size="default"
            pressed={pressed}
            onPressedChange={(next) => onChange(next ? key : null)}
            className="h-10 sm:h-9"
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </Toggle>
        );
      })}
    </div>
  );
}
