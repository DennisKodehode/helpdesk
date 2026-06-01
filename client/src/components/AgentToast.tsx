import { Check } from "lucide-react";

// Lightweight confirmation toast (page-managed, auto-dismissed). Bottom-center
// card matching the prototype — no global toast provider needed for one surface.
export default function AgentToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[210] flex -translate-x-1/2 items-center gap-2.5 rounded-[var(--r-md)] border border-border bg-card px-[18px] py-3 shadow-[var(--shadow-lg)]"
    >
      <span className="text-eme-fg">
        <Check className="size-4" aria-hidden />
      </span>
      <span className="text-[13.5px] text-foreground">{message}</span>
    </div>
  );
}
