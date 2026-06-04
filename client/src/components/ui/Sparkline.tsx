import { cn } from "@/lib/utils";

type Tone = "ros" | "amb" | "eme";

// Tailwind needs literal class names, so map tones explicitly (same pattern as
// the SLA rings / compliance preview).
const STROKE: Record<Tone, string> = {
  ros: "stroke-ros-dot",
  amb: "stroke-amb-dot",
  eme: "stroke-eme-dot",
};
const FILL: Record<Tone, string> = {
  ros: "fill-ros-dot",
  amb: "fill-amb-dot",
  eme: "fill-eme-dot",
};

interface Props {
  data: number[];
  tone: Tone;
  width?: number;
  height?: number;
  className?: string;
}

// A tiny trend sparkline: a line over `data` with a faint area fill and a dot on
// the last point. Decorative (the value + caption carry the meaning), so it's
// aria-hidden. Ported from the design prototype's `Spark`.
export default function Sparkline({
  data,
  tone,
  width = 140,
  height = 36,
  className,
}: Props) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((v - min) / span) * (height - 8);
    return [x, y] as const;
  });
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const area = `M2 ${height - 3} ${line.slice(1)} L${width - 2} ${height - 3} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={area} className={cn(FILL[tone], "opacity-10")} />
      <path
        d={line}
        className={STROKE[tone]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.1" className={FILL[tone]} />
    </svg>
  );
}
