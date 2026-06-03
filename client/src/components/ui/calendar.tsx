import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ChevronProps, DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

// Structural styles come from "react-day-picker/style.css" (imported once in
// index.css); the warm-paper / soft-violet theming lives in the `.rdp-root`
// override block there. This wrapper only swaps the nav glyphs for the app's
// lucide icon set and lets callers add layout classes.
function CalendarChevron({ orientation, className, size }: ChevronProps) {
  const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
  return <Icon className={cn("size-4", className)} size={size} aria-hidden />;
}

function Calendar({
  className,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(className)}
      components={{ Chevron: CalendarChevron }}
      {...props}
    />
  );
}

export { Calendar };
