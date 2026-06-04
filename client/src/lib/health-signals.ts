import {
  AuditEventType,
  type HealthSignal,
  type HealthSignalId,
  type HealthSignalState,
  type HealthSignalsResponse,
  healthSignalsResponseSchema,
} from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// Activity-page Watchlist data. Admin-only endpoint; the signals' computed
// numbers come from the server, the presentation copy below lives client-side.
export function useHealthSignals() {
  return useQuery<HealthSignalsResponse>({
    queryKey: ["stats", "health-signals"],
    queryFn: ({ signal }) =>
      axios
        .get("/api/stats/health-signals", { signal })
        .then((r) => healthSignalsResponseSchema.parse(r.data)),
  });
}

// state → tone token stem (dot/fg) and human label.
export const STATE_TONE: Record<HealthSignalState, "ros" | "amb" | "eme"> = {
  alert: "ros",
  watch: "amb",
  ok: "eme",
};
export const STATE_LABEL: Record<HealthSignalState, string> = {
  alert: "Needs attention",
  watch: "Watch",
  ok: "Healthy",
};
// Severity sort: alerts first, then watches, then ok.
export const STATE_ORDER: Record<HealthSignalState, number> = {
  alert: 0,
  watch: 1,
  ok: 2,
};

interface SignalMeta {
  label: string;
  unit: string;
  /** Which direction of change is harmful (drives the delta chip colour). */
  worseDir: "up" | "down";
  /** Probable cause + nudge, shown when the signal is in watch/alert. */
  concern: string;
  /** Reassuring read, shown when the signal is healthy. */
  healthy: string;
  /** Clicking the row filters the activity log to this event type. */
  drillType: AuditEventType;
  /** Denominator caption, formatted from the signal's computed numbers. */
  formatSub: (s: HealthSignal) => string;
}

// Static presentation copy. The diagnostic line is state-aware: `concern` names
// the likely cause when something's off, `healthy` reassures when it isn't.
// Keyed by the server's signal id.
export const SIGNAL_META: Record<HealthSignalId, SignalMeta> = {
  "ai-escalation": {
    label: "AI escalation rate",
    unit: "%",
    worseDir: "up",
    concern: "Likely knowledge-base gaps — review the topics escalating most.",
    healthy: "AI is deflecting most tickets — the KB is covering the common questions.",
    drillType: AuditEventType.ai_escalated,
    formatSub: (s) => `${s.numerator} of ${s.denominator} AI-handled tickets`,
  },
  "ai-failures": {
    label: "AI hard failures",
    unit: "",
    worseDir: "up",
    concern:
      "API or parse errors in the AI pipeline — a system fault, not the KB. Check the integration logs.",
    healthy: "No pipeline faults — AI calls are completing cleanly.",
    drillType: AuditEventType.ai_escalated,
    formatSub: (s) =>
      `${s.numerator} of ${s.denominator} ${
        s.denominator === 1 ? "escalation" : "escalations"
      } · API / parse errors`,
  },
  reassignment: {
    label: "Reassignment churn",
    unit: "%",
    worseDir: "up",
    concern:
      "Tickets bouncing between agents — review routing rules and triage assignment.",
    healthy: "Tickets land with the right owner — routing looks healthy.",
    drillType: AuditEventType.assignee_changed,
    formatSub: (s) =>
      `${s.numerator} of ${s.denominator} tickets${
        s.avgHandoffs != null ? ` · avg ${s.avgHandoffs} handoffs` : ""
      }`,
  },
  reopened: {
    label: "Resolutions that didn’t stick",
    unit: "%",
    worseDir: "up",
    concern:
      "Closed too early — customers reopen within a day. Tighten resolution quality first.",
    healthy: "Resolutions are sticking — few quick reopens.",
    drillType: AuditEventType.auto_reopened,
    formatSub: (s) => `${s.numerator} of ${s.denominator} resolved reopened < 24h`,
  },
  priority: {
    label: "Priority re-triage",
    unit: "%",
    worseDir: "up",
    concern: "Intake priority often missed — review how triage grades new tickets.",
    healthy: "Intake grading is mostly landing right.",
    drillType: AuditEventType.priority_changed,
    formatSub: (s) => `${s.numerator} of ${s.denominator} tickets re-graded`,
  },
};
