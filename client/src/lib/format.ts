export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  // Always show hours (no days). At display-serif sizes, "1d" reads as
  // "ld" because the digit 1 is just a vertical stroke — hours stay legible.
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
