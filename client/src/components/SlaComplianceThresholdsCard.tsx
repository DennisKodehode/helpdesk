import { Gauge } from "lucide-react";
import FieldError from "@/components/ui/FieldError";
import { Input } from "@/components/ui/input";

interface Props {
  greenMin: number;
  yellowMin: number;
  onChange: (field: "slaGreenMin" | "slaYellowMin", value: number) => void;
}

// Parse + clamp a percent input to an integer in [0, 100]; empty/NaN → 0.
function clampPct(raw: string): number {
  const n = Math.round(Number.parseFloat(raw));
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function ThresholdInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5">
      <span className="text-[13px] text-ink-2">{label}</span>
      <Input
        id={id}
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(clampPct(e.target.value))}
        className="w-[72px] text-right font-mono tabular"
      />
      <span className="font-mono text-[11px] text-ink-4">%</span>
    </label>
  );
}

function Swatch({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// Admin editor for the dashboard SLA-compliance ring colours. Lives on the SLA
// targets tab; persists through the Workflow page's shared draft/save flow as
// part of workflow_settings. The legend mirrors the live ring tones.
export default function SlaComplianceThresholdsCard({
  greenMin,
  yellowMin,
  onChange,
}: Props) {
  const invalid = greenMin <= yellowMin;
  return (
    <div className="rounded-[var(--r-lg)] border border-border bg-card px-[26px] py-[22px]">
      <div className="flex items-center gap-2.5">
        <Gauge aria-hidden className="size-4 text-ink-3" />
        <h2 className="eyebrow">Compliance thresholds</h2>
      </div>
      <p className="mt-2 max-w-[640px] text-[12.5px] leading-relaxed text-ink-3">
        Colours the SLA-compliance rings on the dashboard. At or above the green mark
        reads healthy; at or above yellow reads warning; below yellow reads breaching.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-9 gap-y-3">
        <ThresholdInput
          id="sla-green-min"
          label="Healthy (green) ≥"
          value={greenMin}
          onChange={(v) => onChange("slaGreenMin", v)}
        />
        <ThresholdInput
          id="sla-yellow-min"
          label="Warning (yellow) ≥"
          value={yellowMin}
          onChange={(v) => onChange("slaYellowMin", v)}
        />
      </div>

      {/* Live legend mirroring the dashboard ring tones. */}
      <div className="mt-4 flex flex-wrap gap-4 font-mono text-[11px] text-ink-3">
        <Swatch dot="bg-eme-dot" label={`Green ≥ ${greenMin}`} />
        <Swatch
          dot="bg-amb-dot"
          label={invalid ? "Yellow —" : `Yellow ${yellowMin}–${greenMin - 1}`}
        />
        <Swatch dot="bg-ros-dot" label={`Red < ${yellowMin}`} />
      </div>

      <FieldError
        message={
          invalid ? "Green threshold must be above the yellow threshold." : undefined
        }
      />
    </div>
  );
}
