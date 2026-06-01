import { type SlaPolicy, TicketPriority } from "@helpdesk/core";
import { useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SlaHealthCard from "@/components/SlaHealthCard";
import SlaTargetCard, { type EditablePolicy } from "@/components/SlaTargetCard";
import { Button } from "@/components/ui/button";
import ErrorAlert from "@/components/ui/ErrorAlert";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useSlaPoliciesList, useUpdateSlaPolicy } from "@/lib/sla-policies";

// Most-aggressive first, so the page reads top-down by urgency.
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

export default function SlaPoliciesPage() {
  const { data: serverPolicies, isPending, isError } = useSlaPoliciesList();
  const updatePolicy = useUpdateSlaPolicy();
  const queryClient = useQueryClient();

  const baseline = useMemo(
    () => (serverPolicies ? toEditable(serverPolicies) : null),
    [serverPolicies],
  );
  const [draft, setDraft] = useState<EditablePolicy[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Adopt the server snapshot whenever it (re)loads, unless the user has
  // unsaved edits in flight (don't clobber their work on a background refetch).
  useEffect(() => {
    if (!baseline) return;
    setDraft((cur) =>
      cur && JSON.stringify(cur) !== JSON.stringify(baseline) ? cur : baseline,
    );
  }, [baseline]);

  // Clear the transient "Saved" chip after a moment.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2600);
    return () => clearTimeout(t);
  }, [saved]);

  const dirty =
    draft != null &&
    baseline != null &&
    JSON.stringify(draft) !== JSON.stringify(baseline);

  function handleChange(
    priority: TicketPriority,
    which: "firstResponseMinutes" | "resolutionMinutes",
    value: number | null,
  ) {
    setSaved(false);
    setDraft(
      (cur) =>
        cur?.map((p) => (p.priority === priority ? { ...p, [which]: value } : p)) ?? cur,
    );
  }

  function handleRevert() {
    setDraft(baseline);
    setSaved(false);
  }

  async function handleSave() {
    if (!draft || !baseline) return;
    setSaving(true);
    const changed = draft.filter((d) => {
      const b = baseline.find((x) => x.priority === d.priority);
      return (
        d.firstResponseMinutes !== b?.firstResponseMinutes ||
        d.resolutionMinutes !== b?.resolutionMinutes
      );
    });
    // Per-priority PATCH; non-atomic by design — keep failed edits dirty.
    const results = await Promise.allSettled(
      changed.map((d) =>
        updatePolicy.mutateAsync({
          priority: d.priority,
          data: {
            firstResponseMinutes: d.firstResponseMinutes,
            resolutionMinutes: d.resolutionMinutes,
          },
        }),
      ),
    );
    setSaving(false);
    await queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
    await queryClient.invalidateQueries({ queryKey: ["stats", "sla-health"] });
    if (results.every((r) => r.status === "fulfilled")) setSaved(true);
  }

  return (
    <PageContainer width="dashboard">
      <PageHeader
        eyebrow="Administration"
        title="SLA targets"
        description="Response and resolution windows the queue is measured against, set per priority."
        action={
          dirty ? (
            <div className="flex gap-2.5">
              <Button variant="ghost" size="sm" onClick={handleRevert} disabled={saving}>
                <RotateCcw aria-hidden /> Revert
              </Button>
              <Button variant="accent" size="sm" onClick={handleSave} disabled={saving}>
                <Check aria-hidden /> Save targets
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
        <ErrorAlert message="Failed to load SLA targets. Try refreshing the page." />
      )}

      <SlaHealthCard />

      <div className="mb-3.5 flex items-center gap-2.5">
        <Target aria-hidden className="size-4 text-ink-3" />
        <h2 className="eyebrow">Targets by priority</h2>
      </div>

      {isPending || !draft ? (
        <div className="space-y-3.5" role="status" aria-label="Loading SLA targets">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
            <Skeleton key={i} className="h-[120px] w-full rounded-[var(--r-lg)]" />
          ))}
        </div>
      ) : (
        <div className="space-y-3.5">
          {draft.map((policy) => (
            <SlaTargetCard
              key={policy.priority}
              policy={policy}
              onChange={handleChange}
            />
          ))}
        </div>
      )}

      <p className="mt-[26px] max-w-[780px] font-mono text-[11.5px] leading-[1.7] text-ink-4">
        <span className="text-ink-3">NOTE</span> — Targets count from ticket arrival. A
        ticket flips to <span className="text-amb-fg">At risk</span> once 75% of a window
        has elapsed, and <span className="text-ros-fg">Breached</span> when it passes.
        Resolved and closed tickets never carry an SLA badge. A metric with no target is
        skipped entirely.
      </p>
    </PageContainer>
  );
}
