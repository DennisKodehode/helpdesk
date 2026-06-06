import { CalendarDays } from "lucide-react";
import { useState } from "react";
import type { Matcher } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ISO "yyyy-MM-dd" <-> local Date. We deliberately build the Date in local time
// (component parts), never `new Date(iso)` — that parses as UTC midnight and can
// slip a day in negative-offset zones, picking the wrong date in the calendar.
function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Display format is dd.mm.yyyy regardless of the browser locale — the whole
// reason this replaces the native <input type="date">.
function formatDotted(iso: string): string {
  const date = isoToDate(iso);
  if (!date) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${date.getFullYear()}`;
}

interface Props {
  /** Selected date as an ISO `yyyy-MM-dd` string; "" when unset. */
  value: string;
  onChange: (iso: string) => void;
  ariaLabel: string;
  placeholder?: string;
  /** Inclusive lower bound (ISO); earlier days are disabled. */
  min?: string;
  /** Inclusive upper bound (ISO); later days are disabled. */
  max?: string;
  className?: string;
}

export default function DatePicker({
  value,
  onChange,
  ariaLabel,
  placeholder = "dd.mm.yyyy",
  min,
  max,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = isoToDate(value);
  const minDate = isoToDate(min ?? "");
  const maxDate = isoToDate(max ?? "");

  const disabled: Matcher[] = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={ariaLabel}
        data-empty={!value}
        className={cn(
          "flex h-10 items-center gap-2 rounded-lg border border-input bg-transparent px-[13px] text-[13px] text-foreground transition-colors outline-none hover:bg-panel-2 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-[var(--accent-tint)] data-[empty=true]:text-ink-4 sm:h-9",
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-ink-4" aria-hidden />
        <span className="flex-1 text-left tabular-nums">
          {value ? formatDotted(value) : placeholder}
        </span>
      </PopoverTrigger>
      {/* Pin the calendar below the trigger: never flip above (`side: "none"`)
          or jump to the side (`fallbackAxisSide: "none"`); still shift
          horizontally to stay on-screen. */}
      <PopoverContent
        align="start"
        className="w-auto"
        collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(dateToIso(date));
            setOpen(false);
          }}
          disabled={disabled.length ? disabled : undefined}
          defaultMonth={selected ?? maxDate ?? minDate}
          autoFocus
        />
        {value && (
          <div className="mt-2 flex justify-end border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 transition-colors hover:bg-panel-2 hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
