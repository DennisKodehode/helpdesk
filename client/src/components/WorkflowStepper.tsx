import { Minus, Plus } from "lucide-react";

interface Props {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Appended after the number, e.g. "%" or " days". */
  suffix?: string;
  /** Accessible name for the control (e.g. "Confidence threshold"). */
  label: string;
}

// −/＋ integer stepper, clamped to [min, max] with the buttons disabled at the
// bounds. Mirrors the Workflow design prototype's Stepper.
export default function WorkflowStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  label,
}: Props) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="inline-flex items-center overflow-hidden rounded-[var(--r-sm)] border border-hairline-strong bg-card">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="px-2.5 py-2 text-ink-3 transition-colors hover:bg-panel-2 disabled:pointer-events-none disabled:opacity-40"
      >
        <Minus aria-hidden className="size-3.5" />
      </button>
      <span className="min-w-[58px] px-0.5 text-center font-mono text-sm text-ink tabular-nums">
        {value}
        {suffix}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="px-2.5 py-2 text-ink-3 transition-colors hover:bg-panel-2 disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}
