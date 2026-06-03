import { AutoAssignMode } from "@helpdesk/core";
import { Clock, Reply, Shield, Sparkles, Tag, UserCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { WorkflowRule, WorkflowRuleGroup } from "@/components/WorkflowRule";
import WorkflowStepper from "@/components/WorkflowStepper";
import type { LifecycleDraft } from "@/lib/workflow-settings";

interface Props {
  life: LifecycleDraft;
  set: <K extends keyof LifecycleDraft>(key: K, value: LifecycleDraft[K]) => void;
}

function thresholdHint(v: number) {
  if (v >= 90) return "conservative";
  if (v >= 75) return "balanced";
  return "aggressive";
}

// Panel 1 of the Workflow screen: the three lifecycle-rule groups. Copy is
// verbatim from the design handoff. Dependent controls (strategy select,
// threshold/quiet-period steppers) dim when their row's switch is off.
export default function LifecycleRulesPanel({ life, set }: Props) {
  return (
    <div className="animate-in fade-in duration-200">
      <WorkflowRuleGroup label="Triage & routing">
        <WorkflowRule
          icon={<UserCheck aria-hidden className="size-[18px]" />}
          title="Auto-assign new tickets"
          desc="When AI finishes triage, hand the ticket to an available agent automatically instead of leaving it unassigned."
          on={life.autoAssignOn}
          onToggle={(v) => set("autoAssignOn", v)}
        >
          <div className="flex items-center gap-2.5">
            <span className="eyebrow">Strategy</span>
            <Select
              value={life.autoAssignMode}
              onValueChange={(v) => set("autoAssignMode", v as AutoAssignMode)}
            >
              <SelectTrigger
                className="h-9 w-auto min-w-[168px] text-[13px]"
                aria-label="Strategy"
              >
                <span data-slot="select-value" className="flex flex-1 text-left">
                  {life.autoAssignMode === AutoAssignMode.least_loaded
                    ? "Fewest open tickets"
                    : "Round-robin"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AutoAssignMode.round_robin}>Round-robin</SelectItem>
                <SelectItem value={AutoAssignMode.least_loaded}>
                  Fewest open tickets
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </WorkflowRule>
      </WorkflowRuleGroup>

      <WorkflowRuleGroup label="Resolution">
        <WorkflowRule
          icon={<Sparkles aria-hidden className="size-[18px]" />}
          title="Let AI auto-resolve routine tickets"
          desc="If the AI's confidence on a drafted reply meets the threshold, it sends and resolves without an agent. Lower-confidence tickets always wait for a human."
          on={life.autoResolveOn}
          onToggle={(v) => set("autoResolveOn", v)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">Confidence threshold</span>
            <WorkflowStepper
              value={life.autoResolveThreshold}
              onChange={(v) => set("autoResolveThreshold", v)}
              min={50}
              max={99}
              suffix="%"
              label="confidence threshold"
            />
            <span className="font-mono text-[11px] text-ink-4">
              {thresholdHint(life.autoResolveThreshold)}
            </span>
          </div>
        </WorkflowRule>
        <WorkflowRule
          icon={<Tag aria-hidden className="size-[18px]" />}
          title="Require a category before resolving"
          desc="Agents can't mark a ticket resolved until it's categorised — keeps reporting clean."
          on={life.requireCategory}
          onToggle={(v) => set("requireCategory", v)}
        />
        <WorkflowRule
          icon={<UserCheck aria-hidden className="size-[18px]" />}
          title="Require an assignee before resolving"
          desc="Every resolved ticket must have an owner on record for accountability."
          on={life.requireAssignee}
          onToggle={(v) => set("requireAssignee", v)}
        />
      </WorkflowRuleGroup>

      <WorkflowRuleGroup label="Closing & reopening">
        <WorkflowRule
          icon={<Clock aria-hidden className="size-[18px]" />}
          title="Auto-close resolved tickets"
          desc="A resolved ticket with no further customer reply is closed automatically after a quiet period."
          on={life.autoCloseOn}
          onToggle={(v) => set("autoCloseOn", v)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">Quiet period</span>
            <WorkflowStepper
              value={life.autoCloseDays}
              onChange={(v) => set("autoCloseDays", v)}
              min={1}
              max={30}
              suffix={life.autoCloseDays === 1 ? " day" : " days"}
              label="quiet period"
            />
          </div>
        </WorkflowRule>
        <WorkflowRule
          icon={<Reply aria-hidden className="size-[18px]" />}
          title="Reopen on customer reply"
          desc="If a customer replies to a resolved ticket, move it back to Open and notify the assignee."
          on={life.reopenOnReply}
          onToggle={(v) => set("reopenOnReply", v)}
        />
        <WorkflowRule
          icon={<Shield aria-hidden className="size-[18px]" />}
          title="Lock closed tickets"
          desc="Closed tickets become read-only. An agent must explicitly reopen one before editing or replying."
          on={life.lockClosed}
          onToggle={(v) => set("lockClosed", v)}
        />
      </WorkflowRuleGroup>
    </div>
  );
}
