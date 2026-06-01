import type { AiActivityResponse } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Sparkles } from "lucide-react";

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-right">
      <div className="display-serif tabular text-[26px] leading-none text-foreground">
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-accent-ink">
        {label}
      </div>
    </div>
  );
}

// The AI Agent isn't a roster seat — it's surfaced as a distinct automation
// strip above the table, with its 7-day throughput from the dashboard query.
export default function AiAutomationStrip() {
  const { data } = useQuery<AiActivityResponse>({
    queryKey: ["stats", "ai-activity"],
    queryFn: ({ signal }) =>
      axios
        .get<AiActivityResponse>("/api/stats/ai-activity", { signal })
        .then((r) => r.data),
  });

  return (
    <div className="ai-surface mb-[22px] flex items-center gap-4 rounded-[var(--r-lg)] px-[22px] py-[18px]">
      <span className="grid size-[42px] place-items-center rounded-full bg-[var(--accent-tint-2)] text-accent-ink">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[15px] font-semibold text-foreground">AI Agent</span>
          <span className="ai-chip">
            <Sparkles className="size-2.5" aria-hidden /> Automation
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-ink-3">
          Triages and drafts on arrival, auto-resolves routine tickets. Always on — not
          counted as a seat.
        </p>
      </div>
      <div className="flex shrink-0 gap-[30px]">
        <Metric value={data?.autoResolved ?? 0} label="auto-resolved · 7d" />
        <Metric value={data?.repliesSent ?? 0} label="drafted · 7d" />
      </div>
    </div>
  );
}
