import type { TicketPriority } from "@helpdesk/core";
import { Target } from "lucide-react";
import SlaHealthCard from "@/components/SlaHealthCard";
import SlaTargetCard, { type EditablePolicy } from "@/components/SlaTargetCard";

interface Props {
  policies: EditablePolicy[];
  onChange: (
    priority: TicketPriority,
    which: "firstResponseMinutes" | "resolutionMinutes",
    value: number | null,
  ) => void;
}

// Panel 2 of the Workflow screen: the SLA targets, re-housed from the standalone
// SLA page. Pure reuse of the existing SLA components — the contract and math
// are untouched. The page's unified save bar drives persistence.
export default function SlaTargetsPanel({ policies, onChange }: Props) {
  return (
    <div className="animate-in fade-in duration-200">
      <SlaHealthCard />

      <div className="mb-3.5 flex items-center gap-2.5 px-0.5">
        <Target aria-hidden className="size-4 text-ink-3" />
        <h2 className="eyebrow">Targets by priority</h2>
      </div>

      <div className="space-y-3.5">
        {policies.map((policy) => (
          <SlaTargetCard key={policy.priority} policy={policy} onChange={onChange} />
        ))}
      </div>

      <p className="mt-[26px] max-w-[780px] font-mono text-[11.5px] leading-[1.7] text-ink-4">
        <span className="text-ink-3">NOTE</span> — Targets count from ticket arrival. A
        ticket flips to <span className="text-amb-fg">At risk</span> once 75% of a window
        has elapsed, and <span className="text-ros-fg">Breached</span> when it passes.
        Resolved and closed tickets never carry an SLA badge. A metric with no target is
        skipped entirely.
      </p>
    </div>
  );
}
