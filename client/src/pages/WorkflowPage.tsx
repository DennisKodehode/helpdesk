import { type SlaPolicy, TicketPriority } from "@helpdesk/core";
import { useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import LifecycleRulesPanel from "@/components/LifecycleRulesPanel";
import type { EditablePolicy } from "@/components/SlaTargetCard";
import SlaTargetsPanel from "@/components/SlaTargetsPanel";
import { Button } from "@/components/ui/button";
import ErrorAlert from "@/components/ui/ErrorAlert";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import WorkflowPipeline, { type PipelineCounts } from "@/components/WorkflowPipeline";
import { useSlaPoliciesList, useUpdateSlaPolicy } from "@/lib/sla-policies";
import { useStats } from "@/lib/stats";
import { cn } from "@/lib/utils";
import {
  type LifecycleDraft,
  useUpdateWorkflowSettings,
  useWorkflowSettings,
} from "@/lib/workflow-settings";

// Most-aggressive first, so the SLA panel reads top-down by urgency.
const PRIORITY_ORDER: TicketPriority[] = [
  TicketPriority.urgent,
  TicketPriority.high,
  TicketPriority.normal,
  TicketPriority.low,
];

function toEditable(policies: SlaPolicy[]): EditablePolicy[] {
  return PRIORITY_ORDER.map((priority) => {
    const p = policies.find((x) => x.priority === priority);
    return {
      priority,
      firstResponseMinutes: p?.firstResponseMinutes ?? null,
      resolutionMinutes: p?.resolutionMinutes ?? null,
    };
  });
}

// The lifecycle rules minus the two SLA-ring thresholds — used so the dirty
// label can tell "Lifecycle" edits apart from threshold edits (which read SLA).
function stripThresholds(life: LifecycleDraft) {
  const { slaGreenMin: _g, slaYellowMin: _y, ...rest } = life;
  return rest;
}

type Tab = "lifecycle" | "sla";

function Segmented({ value, onChange }: { value: Tab; onChange: (v: Tab) => void }) {
  const options: { value: Tab; label: string; icon: React.ReactNode }[] = [
    {
      value: "lifecycle",
      label: "Lifecycle rules",
      icon: <RotateCcw className="size-3.5" />,
    },
    { value: "sla", label: "SLA targets", icon: <Target className="size-3.5" /> },
  ];
  return (
    <div
      role="tablist"
      className="inline-flex gap-[3px] rounded-[var(--r-sm)] border border-border bg-panel-2 p-[3px]"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-[7px] whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] transition-colors",
              active
                ? "bg-card font-semibold text-ink shadow-sm"
                : "font-medium text-ink-3 hover:text-ink-2",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function WorkflowPage() {
  const settingsQuery = useWorkflowSettings();
  const policiesQuery = useSlaPoliciesList();
  const statsQuery = useStats();
  const updateSettings = useUpdateWorkflowSettings();
  const updatePolicy = useUpdateSlaPolicy();
  const queryClient = useQueryClient();

  const baselineLife = useMemo<LifecycleDraft | null>(() => {
    if (!settingsQuery.data) return null;
    const { updatedAt: _omit, ...rest } = settingsQuery.data;
    return rest;
  }, [settingsQuery.data]);

  const baselinePolicies = useMemo(
    () => (policiesQuery.data ? toEditable(policiesQuery.data) : null),
    [policiesQuery.data],
  );

  const [life, setLife] = useState<LifecycleDraft | null>(null);
  const [policies, setPolicies] = useState<EditablePolicy[] | null>(null);
  const [tab, setTab] = useState<Tab>("lifecycle");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Adopt each server snapshot when it (re)loads, unless the user has unsaved
  // edits in flight (don't clobber their work on a background refetch).
  useEffect(() => {
    if (!baselineLife) return;
    setLife((cur) =>
      cur && JSON.stringify(cur) !== JSON.stringify(baselineLife) ? cur : baselineLife,
    );
  }, [baselineLife]);
  useEffect(() => {
    if (!baselinePolicies) return;
    setPolicies((cur) =>
      cur && JSON.stringify(cur) !== JSON.stringify(baselinePolicies)
        ? cur
        : baselinePolicies,
    );
  }, [baselinePolicies]);

  // Clear the transient "Saved" chip after a moment.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2600);
    return () => clearTimeout(t);
  }, [saved]);

  const lifeDirty =
    life != null &&
    baselineLife != null &&
    JSON.stringify(life) !== JSON.stringify(baselineLife);
  const policiesDirty =
    policies != null &&
    baselinePolicies != null &&
    JSON.stringify(policies) !== JSON.stringify(baselinePolicies);
  const dirty = lifeDirty || policiesDirty;

  // slaGreenMin/slaYellowMin live in workflow_settings (life) but are edited on
  // the SLA tab — so count their dirtiness toward SLA, not Lifecycle, for the
  // unsaved-changes label. Persistence is unchanged: they still PATCH with the
  // rest of `life` (see handleSave's lifeDirty branch).
  const thresholdsDirty =
    life != null &&
    baselineLife != null &&
    (life.slaGreenMin !== baselineLife.slaGreenMin ||
      life.slaYellowMin !== baselineLife.slaYellowMin);
  const rulesDirty =
    life != null &&
    baselineLife != null &&
    JSON.stringify(stripThresholds(life)) !==
      JSON.stringify(stripThresholds(baselineLife));
  const slaDirty = policiesDirty || thresholdsDirty;

  // The SLA-compliance ring thresholds must stay ordered (green above yellow);
  // block the save while they're inverted (the server rejects it too).
  const thresholdsValid = life == null || life.slaGreenMin > life.slaYellowMin;

  const counts: PipelineCounts = {
    triaging: statsQuery.data?.triagingTickets ?? 0,
    open: statsQuery.data?.openTickets ?? 0,
    resolved: statsQuery.data?.resolvedTickets ?? 0,
    closed: statsQuery.data?.closedTickets ?? 0,
  };

  function setLifeField<K extends keyof LifecycleDraft>(
    key: K,
    value: LifecycleDraft[K],
  ) {
    setSaved(false);
    setLife((cur) => (cur ? { ...cur, [key]: value } : cur));
  }

  function changePolicy(
    priority: TicketPriority,
    which: "firstResponseMinutes" | "resolutionMinutes",
    value: number | null,
  ) {
    setSaved(false);
    setPolicies(
      (cur) =>
        cur?.map((p) => (p.priority === priority ? { ...p, [which]: value } : p)) ?? cur,
    );
  }

  function handleRevert() {
    setLife(baselineLife);
    setPolicies(baselinePolicies);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const work: Promise<unknown>[] = [];

    if (lifeDirty && life) {
      work.push(updateSettings.mutateAsync(life));
    }
    if (policiesDirty && policies && baselinePolicies) {
      const changed = policies.filter((d) => {
        const b = baselinePolicies.find((x) => x.priority === d.priority);
        return (
          d.firstResponseMinutes !== b?.firstResponseMinutes ||
          d.resolutionMinutes !== b?.resolutionMinutes
        );
      });
      for (const d of changed) {
        work.push(
          updatePolicy.mutateAsync({
            priority: d.priority,
            data: {
              firstResponseMinutes: d.firstResponseMinutes,
              resolutionMinutes: d.resolutionMinutes,
            },
          }),
        );
      }
    }

    // Non-atomic by design — failed edits stay dirty so the user can retry.
    const results = await Promise.allSettled(work);
    setSaving(false);
    await queryClient.invalidateQueries({ queryKey: ["workflow-settings"] });
    await queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
    await queryClient.invalidateQueries({ queryKey: ["stats", "sla-health"] });
    if (results.every((r) => r.status === "fulfilled")) setSaved(true);
  }

  const dirtyCount = (rulesDirty ? 1 : 0) + (slaDirty ? 1 : 0);
  const dirtyLabel =
    dirtyCount === 2
      ? "Lifecycle & SLA have"
      : rulesDirty
        ? "Lifecycle has"
        : "SLA targets have";

  const isError = settingsQuery.isError || policiesQuery.isError;

  return (
    <PageContainer width="dashboard">
      <PageHeader
        title="Workflow"
        description="The rules every ticket follows from arrival to close, and the SLA windows the queue is measured against."
        action={
          dirty ? (
            <div className="flex gap-2.5">
              <Button variant="ghost" size="sm" onClick={handleRevert} disabled={saving}>
                <RotateCcw aria-hidden /> Revert
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={handleSave}
                disabled={saving || !thresholdsValid}
              >
                <Check aria-hidden /> Save changes
              </Button>
            </div>
          ) : saved ? (
            <span className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-eme-dot/30 px-3 py-1.5 text-[13px] text-eme-fg">
              <Check aria-hidden className="size-4" /> Saved
            </span>
          ) : undefined
        }
      />

      {isError && (
        <ErrorAlert message="Failed to load workflow settings. Try refreshing the page." />
      )}

      {life && <WorkflowPipeline life={life} counts={counts} />}

      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4">
        <Segmented value={tab} onChange={setTab} />
        {dirty && (
          <span className="inline-flex items-center gap-[7px] font-mono text-[11px] text-amb-fg">
            <span className="size-[7px] rounded-full bg-amb-dot" />
            {dirtyLabel} unsaved changes
          </span>
        )}
      </div>

      {tab === "lifecycle" ? (
        life ? (
          <LifecycleRulesPanel life={life} set={setLifeField} />
        ) : (
          <PanelSkeleton />
        )
      ) : policies && life ? (
        <SlaTargetsPanel
          policies={policies}
          onChange={changePolicy}
          greenMin={life.slaGreenMin}
          yellowMin={life.slaYellowMin}
          onThresholdChange={(field, value) => setLifeField(field, value)}
        />
      ) : (
        <PanelSkeleton />
      )}

      {/* Sticky save bar — keeps Revert/Save reachable from the bottom of a long
          page (the header actions scroll off). Duplicate of the header actions. */}
      {dirty && (
        <section aria-label="Unsaved changes" className="sticky bottom-[18px] z-30 mt-7">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--r-lg)] border border-hairline-strong bg-card py-[11px] pr-3.5 pl-5 shadow-[var(--shadow-lg)]">
            <span
              className={cn(
                "inline-flex items-center gap-2 font-mono text-[11.5px]",
                thresholdsValid ? "text-amb-fg" : "text-ros-fg",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-[7px] flex-none rounded-full",
                  thresholdsValid ? "bg-amb-dot" : "bg-ros-dot",
                )}
              />
              {thresholdsValid
                ? `${dirtyLabel} unsaved changes`
                : "Green must sit above amber to save"}
            </span>
            <div className="flex gap-2.5">
              <Button variant="ghost" size="sm" onClick={handleRevert} disabled={saving}>
                <RotateCcw aria-hidden /> Revert
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={handleSave}
                disabled={saving || !thresholdsValid}
              >
                <Check aria-hidden /> Save changes
              </Button>
            </div>
          </div>
        </section>
      )}
    </PageContainer>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3.5" role="status" aria-label="Loading workflow settings">
      {Array.from({ length: 3 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
        <Skeleton key={i} className="h-[120px] w-full rounded-[var(--r-lg)]" />
      ))}
    </div>
  );
}
