import { ChevronDown, Reply, RotateCcw, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LifecycleDraft } from "@/lib/workflow-settings";

export interface PipelineCounts {
  triaging: number;
  open: number;
  resolved: number;
  closed: number;
}

type Stage = keyof PipelineCounts;

const STAGE_META: Record<Stage, { label: string; dot: string; note: string }> = {
  triaging: { label: "Triaging", dot: "bg-vio-dot", note: "AI reads & classifies" },
  open: { label: "Open", dot: "bg-amb-dot", note: "assigned · in progress" },
  resolved: { label: "Resolved", dot: "bg-eme-dot", note: "answered · awaiting close" },
  closed: { label: "Closed", dot: "bg-zin-dot", note: "archived & locked" },
};

function StageNode({ stage, count }: { stage: Stage; count: number }) {
  const meta = STAGE_META[stage];
  return (
    <div className="w-full rounded-[var(--r-lg)] border border-border bg-card px-5 py-[18px] @min-[53rem]/pipe:w-auto @min-[53rem]/pipe:min-w-[150px] @min-[53rem]/pipe:flex-1">
      <div className="flex items-center justify-center gap-2 @min-[53rem]/pipe:justify-start">
        <span className={cn("size-[9px] flex-none rounded-full", meta.dot)} />
        <span className="font-serif text-[21px] text-ink">{meta.label}</span>
      </div>
      <div className="mt-3 flex items-baseline justify-center gap-[7px] @min-[53rem]/pipe:justify-start">
        <span className="font-serif text-[32px] leading-[0.9] text-ink tabular-nums">
          {count}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-4">
          active
        </span>
      </div>
      <p className="mt-[9px] text-center font-mono text-[10px] uppercase tracking-[0.05em] text-ink-4 @min-[53rem]/pipe:text-left">
        {meta.note}
      </p>
    </div>
  );
}

// Connector between two stages. Vertical (chevron points down) when the
// pipeline is stacked; horizontal (chevron points right) once the card clears
// ~53rem and the row goes side-by-side. The mono label wraps to 2 lines in the
// narrow horizontal form — that's in-character, not a regression.
function Connector({ label, auto }: { label: string; auto: boolean }) {
  return (
    <div className="flex flex-col items-center gap-[7px] self-center @min-[53rem]/pipe:flex-[0_0_68px] @min-[53rem]/pipe:min-w-[60px]">
      <span
        className={cn(
          "max-w-[120px] text-center font-mono text-[9.5px] uppercase leading-[1.35] tracking-[0.07em]",
          auto ? "text-accent-ink" : "text-ink-4",
        )}
      >
        {auto && (
          <Sparkles aria-hidden className="mr-[3px] inline size-2.5 align-[-1px]" />
        )}
        {label}
      </span>
      <div className="flex flex-col items-center @min-[53rem]/pipe:w-full @min-[53rem]/pipe:flex-row">
        <span className="h-4 w-[1.5px] bg-hairline-strong @min-[53rem]/pipe:h-[1.5px] @min-[53rem]/pipe:w-auto @min-[53rem]/pipe:flex-1" />
        <ChevronDown
          aria-hidden
          className="size-[15px] text-hairline-strong @min-[53rem]/pipe:-mr-[3px] @min-[53rem]/pipe:-ml-0.5 @min-[53rem]/pipe:-rotate-90"
        />
      </div>
    </div>
  );
}

function FootnotePill({
  tone,
  icon,
  children,
}: {
  tone: "amb" | "vio" | "zin" | "ghost";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones: Record<typeof tone, string> = {
    amb: "text-amb-fg bg-amb-bg border-amb-dot/30",
    vio: "text-vio-fg bg-vio-bg border-vio-dot/30",
    zin: "text-zin-fg bg-zin-bg border-zin-dot/30",
    ghost: "text-ink-3 bg-panel-2 border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]",
        tones[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

interface Props {
  life: LifecycleDraft;
  counts: PipelineCounts;
}

// Read-only lifecycle visualization. Reflects the working (unsaved) rule state
// so a toggle's consequence is visible immediately. No inputs live here.
export default function WorkflowPipeline({ life, counts }: Props) {
  const gates = [life.requireCategory && "category", life.requireAssignee && "assignee"]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="@container/pipe mb-[22px] rounded-[var(--r-lg)] border border-border bg-card px-[26px] py-6">
      <div className="mb-5 flex items-center gap-2.5">
        <RotateCcw aria-hidden className="size-4 text-ink-3" />
        <p className="eyebrow">The lifecycle · every ticket moves left to right</p>
      </div>

      {/* Stacked top-to-bottom by default; flips to a side-by-side row once the
          card clears ~53rem (just above the shrunk row's real min width, so the
          horizontal form never overflows the card). No flex-wrap — wrapping is
          what orphaned the connectors. */}
      <div className="flex flex-col items-stretch gap-2 @min-[53rem]/pipe:flex-row @min-[53rem]/pipe:items-stretch @min-[53rem]/pipe:gap-1">
        <StageNode stage="triaging" count={counts.triaging} />
        <Connector
          label={life.autoAssignOn ? "classify · auto-assign" : "AI classifies & routes"}
          auto
        />
        <StageNode stage="open" count={counts.open} />
        <Connector
          label={
            life.autoResolveOn
              ? `AI ≥ ${life.autoResolveThreshold}% resolves`
              : "agent resolves"
          }
          auto={life.autoResolveOn}
        />
        <StageNode stage="resolved" count={counts.resolved} />
        <Connector
          label={
            life.autoCloseOn ? `auto-close · ${life.autoCloseDays}d` : "closed manually"
          }
          auto={life.autoCloseOn}
        />
        <StageNode stage="closed" count={counts.closed} />
      </div>

      <div className="mt-[18px] flex flex-wrap gap-2.5">
        {gates && (
          <FootnotePill tone="amb" icon={<Shield aria-hidden className="size-[11px]" />}>
            Resolve needs {gates}
          </FootnotePill>
        )}
        {life.reopenOnReply && (
          <FootnotePill tone="vio" icon={<Reply aria-hidden className="size-[11px]" />}>
            Reopens on customer reply
          </FootnotePill>
        )}
        {life.lockClosed && (
          <FootnotePill tone="zin" icon={<Shield aria-hidden className="size-[11px]" />}>
            Closed tickets locked
          </FootnotePill>
        )}
        {life.autoResolveOn && (
          <FootnotePill
            tone="ghost"
            icon={<Sparkles aria-hidden className="size-[11px]" />}
          >
            AI auto-resolve on
          </FootnotePill>
        )}
      </div>
    </div>
  );
}
