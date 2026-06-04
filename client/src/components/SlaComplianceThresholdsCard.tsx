import WorkflowStepper from "@/components/WorkflowStepper";
import { useSlaCompliance } from "@/lib/stats";
import { cn } from "@/lib/utils";

interface Props {
  greenMin: number;
  yellowMin: number;
  onChange: (field: "slaGreenMin" | "slaYellowMin", value: number) => void;
}

const RADIUS = 26;
const CIRC = 2 * Math.PI * RADIUS;

type Tone = "eme" | "amb" | "ros" | "zin";

// Tailwind needs literal class names, so map tones explicitly rather than
// interpolating (mirrors ringStroke in dashboard/SlaRingsCard.tsx).
const DOT_BG: Record<Tone, string> = {
  eme: "bg-eme-dot",
  amb: "bg-amb-dot",
  ros: "bg-ros-dot",
  zin: "bg-zin-dot",
};
const FG_TEXT: Record<Tone, string> = {
  eme: "text-eme-fg",
  amb: "text-amb-fg",
  ros: "text-ros-fg",
  zin: "text-zin-fg",
};
const STROKE: Record<Tone, string> = {
  eme: "stroke-eme-dot",
  amb: "stroke-amb-dot",
  ros: "stroke-ros-dot",
  zin: "stroke-zin-dot",
};
const CARET_BORDER: Record<Tone, string> = {
  eme: "border-t-eme-dot",
  amb: "border-t-amb-dot",
  ros: "border-t-ros-dot",
  zin: "border-t-zin-dot",
};

// Which band a percent falls in, given the working-draft thresholds.
function bandTone(pct: number, green: number, yellow: number): Tone {
  if (pct >= green) return "eme";
  if (pct >= yellow) return "amb";
  return "ros";
}

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

// One dashboard ring, recoloured live from the working-draft thresholds.
function PreviewRing({
  pct,
  label,
  green,
  yellow,
}: {
  pct: number | null;
  label: string;
  green: number;
  yellow: number;
}) {
  const tone: Tone | null = pct == null ? null : bandTone(pct, green, yellow);
  const offset = CIRC * (1 - (pct ?? 0) / 100);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-[66px]">
        <svg viewBox="0 0 66 66" className="size-full -rotate-90" aria-hidden="true">
          <circle
            cx="33"
            cy="33"
            r={RADIUS}
            fill="none"
            strokeWidth="6"
            className="stroke-panel-inset"
          />
          {pct != null && tone != null && (
            <circle
              cx="33"
              cy="33"
              r={RADIUS}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className={cn(
                "transition-[stroke,stroke-dashoffset] duration-300",
                STROKE[tone],
              )}
              style={{ strokeDasharray: CIRC, strokeDashoffset: offset }}
            />
          )}
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          <span className="display-serif tabular text-[18px] leading-none text-foreground">
            {pct == null ? "—" : pct}
          </span>
        </span>
      </div>
      <span className="label-meta text-center">{label}</span>
    </div>
  );
}

interface BandMark {
  full: string;
  value: number;
}

// Red→amber→green band with the live ring values plotted as carets, coloured by
// the band they fall in. Collapses to a single neutral band when inverted.
function BandScale({
  green,
  yellow,
  marks,
  invalid,
}: {
  green: number;
  yellow: number;
  marks: BandMark[];
  invalid: boolean;
}) {
  const y = clampPct(yellow);
  const g = clampPct(green);
  const segs: { w: number; tone: Tone }[] = invalid
    ? [{ w: 100, tone: "zin" }]
    : [
        { w: y, tone: "ros" },
        { w: g - y, tone: "amb" },
        { w: 100 - g, tone: "eme" },
      ];
  return (
    <div className="mt-4">
      <div className="relative h-[26px]">
        {marks.map((m) => {
          const tone: Tone = invalid ? "zin" : bandTone(m.value, green, yellow);
          return (
            <div
              key={m.full}
              title={`${m.full} ${m.value}%`}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-0.5"
              style={{ left: `${clampPct(m.value)}%` }}
            >
              <span
                className={cn(
                  "font-mono tabular text-[9.5px] whitespace-nowrap",
                  FG_TEXT[tone],
                )}
              >
                {m.value}
              </span>
              <span
                className={cn(
                  "size-0 border-x-4 border-x-transparent border-t-[5px]",
                  CARET_BORDER[tone],
                )}
              />
            </div>
          );
        })}
      </div>
      <div
        className="flex h-[9px] overflow-hidden rounded-full bg-panel-inset"
        aria-hidden
      >
        {segs.map((s) =>
          s.w > 0 ? (
            <div
              key={s.tone}
              className={cn("transition-[width] duration-200", DOT_BG[s.tone])}
              style={{ width: `${s.w}%` }}
            />
          ) : null,
        )}
      </div>
      {/* Threshold ticks: a colour-coded line touching the band edge + the value,
          so they visibly track the steppers (amber → 70 slides this to 70%). */}
      <div className="relative mt-1 h-[22px]">
        {!invalid &&
          (
            [
              { v: y, tone: "amb" },
              { v: g, tone: "eme" },
            ] as const
          ).map(({ v, tone }) => (
            <div
              key={tone}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-0.5"
              style={{ left: `${clampPct(v)}%` }}
            >
              <span aria-hidden className={cn("h-2 w-px", DOT_BG[tone])} />
              <span className={cn("font-mono tabular text-[9.5px]", FG_TEXT[tone])}>
                {v}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// A single threshold row: tone dot + fixed-width label + stepper. The two rows
// look identical so the steppers align.
function ThresholdRow({
  tone,
  label,
  value,
  field,
  min,
  max,
  onChange,
}: {
  tone: Tone;
  label: string;
  value: number;
  field: "slaGreenMin" | "slaYellowMin";
  min: number;
  max: number;
  onChange: Props["onChange"];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span aria-hidden className={cn("size-2.5 flex-none rounded-full", DOT_BG[tone])} />
      <span className="eyebrow w-[168px]">{label}</span>
      <WorkflowStepper
        value={value}
        onChange={(v) => onChange(field, v)}
        min={min}
        max={max}
        suffix="%"
        label={label}
      />
    </div>
  );
}

function Swatch({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 flex-none rounded-full", DOT_BG[tone])} />
      {label}
    </span>
  );
}

// Admin editor for the dashboard SLA-compliance ring colours. Lives on the SLA
// targets tab; persists through the Workflow page's shared draft/save flow as
// part of workflow_settings. The cross-clamped steppers keep green strictly
// above amber, and a live preview ties the percents to the rings they drive.
export default function SlaComplianceThresholdsCard({
  greenMin,
  yellowMin,
  onChange,
}: Props) {
  const invalid = greenMin <= yellowMin;
  const compliance = useSlaCompliance();
  const firstResponse = compliance.data?.firstResponse ?? null;
  const resolution = compliance.data?.resolution ?? null;
  // Only plot measurable metrics on the band; null means "nothing to measure".
  const marks: BandMark[] = [
    firstResponse != null && { full: "First response", value: firstResponse },
    resolution != null && { full: "Resolution", value: resolution },
  ].filter((m): m is BandMark => m !== false);

  return (
    <div className="flex flex-wrap items-start gap-7 rounded-[var(--r-lg)] border border-border bg-card px-[26px] py-[22px]">
      {/* Left — the controls. */}
      <div className="min-w-[288px] flex-[1_1_320px]">
        <p className="max-w-[460px] text-[13px] leading-relaxed text-ink-3">
          Where the dashboard's 30-day compliance gauges turn green, amber, or red. These
          are display bands for the rings only — they don't change the targets above or
          what counts as breached.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <ThresholdRow
            tone="eme"
            label="Healthy · green ≥"
            value={greenMin}
            field="slaGreenMin"
            min={yellowMin + 1}
            max={100}
            onChange={onChange}
          />
          <ThresholdRow
            tone="amb"
            label="Warning · amber ≥"
            value={yellowMin}
            field="slaYellowMin"
            min={0}
            max={greenMin - 1}
            onChange={onChange}
          />
        </div>

        {/* A legend, not a control. */}
        <div className="mt-4 flex flex-wrap gap-x-[18px] gap-y-2 border-t border-border pt-3.5 font-mono text-[11px] text-ink-3">
          <Swatch tone="eme" label={`Green ≥ ${greenMin}`} />
          <Swatch
            tone="amb"
            label={invalid ? "Amber —" : `Amber ${yellowMin}–${greenMin - 1}`}
          />
          <Swatch tone="ros" label={`Red < ${yellowMin}`} />
        </div>

        {invalid && (
          <p className="mt-3.5 inline-flex items-center gap-2 font-mono text-[11px] text-amb-fg">
            <span aria-hidden className="size-[7px] flex-none rounded-full bg-amb-dot" />
            Green must sit above amber — raise the green mark or lower amber.
          </p>
        )}
      </div>

      {/* Divider. */}
      <div aria-hidden className="w-px self-stretch bg-border" />

      {/* Right — a live preview. */}
      <div className="min-w-[240px] flex-[1_1_248px]">
        <span className="eyebrow mb-3.5 block">Preview · live dashboard</span>
        <div className="flex justify-center gap-[30px]">
          <PreviewRing
            pct={firstResponse}
            label="First response"
            green={greenMin}
            yellow={yellowMin}
          />
          <PreviewRing
            pct={resolution}
            label="Resolution"
            green={greenMin}
            yellow={yellowMin}
          />
        </div>
        <BandScale green={greenMin} yellow={yellowMin} marks={marks} invalid={invalid} />
      </div>
    </div>
  );
}
