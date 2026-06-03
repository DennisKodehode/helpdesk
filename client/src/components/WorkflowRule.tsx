import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface RuleGroupProps {
  label: string;
  children: ReactNode;
}

// A titled card grouping several Rule rows, separated by hairlines.
export function WorkflowRuleGroup({ label, children }: RuleGroupProps) {
  return (
    <div className="mb-4 overflow-hidden rounded-[var(--r-lg)] border border-border bg-card">
      <div className="px-6 pt-[15px] pb-[13px]">
        <p className="eyebrow">{label}</p>
      </div>
      {children}
    </div>
  );
}

interface RuleProps {
  icon: ReactNode;
  title: string;
  desc: string;
  on: boolean;
  onToggle: (value: boolean) => void;
  /** Optional dependent control shown beneath the description. */
  children?: ReactNode;
}

// One setting row: tinted icon square + title + description on the left, a
// Switch on the right, and an optional dependent control beneath the copy that
// dims and becomes non-interactive when the row's switch is off.
export function WorkflowRule({ icon, title, desc, on, onToggle, children }: RuleProps) {
  return (
    <div className="flex items-start gap-4 border-t border-border px-6 py-5">
      <span className="mt-px grid size-[34px] flex-none place-items-center rounded-[var(--r-sm)] bg-panel-2 text-ink-3">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-[650] text-ink">{title}</div>
        <p className="mt-1 max-w-[440px] text-[13px] leading-relaxed text-ink-3">
          {desc}
        </p>
        {children && (
          <div
            className={cn(
              "mt-3.5 transition-opacity",
              !on && "pointer-events-none opacity-40",
            )}
          >
            {children}
          </div>
        )}
      </div>
      <Switch checked={on} onCheckedChange={onToggle} aria-label={title} />
    </div>
  );
}
