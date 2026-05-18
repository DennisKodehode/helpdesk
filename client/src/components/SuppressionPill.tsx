import { AlertTriangle } from "lucide-react";
import { BADGE_BASE } from "@/lib/ticket-ui";

interface Props {
  className?: string;
}

/**
 * Warning chip rendered next to a customer's email when Resend has flagged
 * the address as undeliverable (hard bounce or marked-as-spam complaint).
 * Outbound replies to suppressed addresses are silently skipped server-side
 * — this pill is the only signal the agent gets.
 */
export default function SuppressionPill({ className }: Props) {
  return (
    <span
      className={`${BADGE_BASE} border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300 ${className ?? ""}`}
      title="This email address has bounced or marked us as spam. Outbound replies are skipped."
    >
      <AlertTriangle className="size-2.5" aria-hidden />
      Undeliverable
    </span>
  );
}
