import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

const UNIT_FACTOR = { min: 1, hr: 60, day: 1440 } as const;
type Unit = keyof typeof UNIT_FACTOR;
const UNIT_LABEL: Record<Unit, string> = {
  min: "minutes",
  hr: "hours",
  day: "days",
};

// Friendliest unit for a stored minute value (e.g. 1440 → days, 120 → hours).
function pickUnit(minutes: number | null): Unit {
  if (minutes == null) return "hr";
  if (minutes % 1440 === 0 && minutes >= 1440) return "day";
  if (minutes % 60 === 0 && minutes >= 60) return "hr";
  return "min";
}

interface Props {
  /** The target in minutes, or null for "no target". */
  minutes: number | null;
  onChange: (minutes: number | null) => void;
  /** When true, shows a remove (→ null) control and "Add target" when null. */
  allowNone?: boolean;
  /** Used for accessible labels on the number + unit controls. */
  label: string;
}

export default function SlaDurationField({ minutes, onChange, allowNone, label }: Props) {
  const [unit, setUnit] = useState<Unit>(() => pickUnit(minutes));
  // Re-pick the friendly unit only when the value flips to/from null (add or
  // remove) — not on every keystroke, so the user can switch units freely.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only on null-ness change
  useEffect(() => {
    setUnit(pickUnit(minutes));
  }, [minutes == null]);

  if (minutes == null) {
    return (
      <Button type="button" variant="ghost" size="xs" onClick={() => onChange(60)}>
        <Plus aria-hidden /> Add target
      </Button>
    );
  }

  const factor = UNIT_FACTOR[unit];
  const display = +(minutes / factor).toFixed(2);

  return (
    <div className="inline-flex items-center gap-2">
      <Input
        type="number"
        min={1}
        aria-label={`${label} value`}
        value={display}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          onChange(Number.isNaN(v) || v <= 0 ? 1 : Math.round(v * factor));
        }}
        className="w-[76px] text-right font-mono tabular"
      />
      <Select value={unit} onValueChange={(u) => setUnit(u as Unit)}>
        <SelectTrigger
          aria-label={`${label} unit`}
          className="h-9 w-auto min-w-[92px] text-[13px]"
        >
          <span data-slot="select-value" className="flex flex-1 text-left">
            {UNIT_LABEL[unit]}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="min">minutes</SelectItem>
          <SelectItem value="hr">hours</SelectItem>
          <SelectItem value="day">days</SelectItem>
        </SelectContent>
      </Select>
      {allowNone && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${label} target`}
          onClick={() => onChange(null)}
          className="text-ink-4"
        >
          <Minus aria-hidden />
        </Button>
      )}
    </div>
  );
}
