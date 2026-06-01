import type { AiActivityResponse } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Sparkles } from "lucide-react";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";

const ITEMS: { key: keyof AiActivityResponse; label: string; caption: string }[] = [
  { key: "autoResolved", label: "Auto-resolved", caption: "tickets closed by AI" },
  { key: "autoClassified", label: "Auto-classified", caption: "categorised on arrival" },
  { key: "escalated", label: "Escalated", caption: "handed to a human" },
  { key: "repliesSent", label: "Replies sent", caption: "all agents, 7 days" },
];

export default function AiThisWeekCard() {
  const query = useQuery<AiActivityResponse>({
    queryKey: ["stats", "ai-activity"],
    queryFn: ({ signal }) =>
      axios
        .get<AiActivityResponse>("/api/stats/ai-activity", { signal })
        .then((r) => r.data),
  });

  return (
    <section
      aria-labelledby="ai-week-heading"
      className="ai-surface rounded-[var(--r-lg)] p-6"
    >
      <p id="ai-week-heading" className="ai-chip mb-5">
        <Sparkles className="size-3" aria-hidden /> AI this week
      </p>

      {query.isError ? (
        <ErrorAlert message="Failed to load AI activity" />
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-6">
          {ITEMS.map((item) => (
            <div key={item.key}>
              <dd className="display-serif tabular text-[40px] leading-none text-foreground">
                {query.isLoading ? (
                  <Skeleton className="h-9 w-12" />
                ) : (
                  (query.data?.[item.key] ?? 0).toLocaleString()
                )}
              </dd>
              <dt className="mt-2 text-[13px] font-medium text-foreground">
                {item.label}
              </dt>
              <p className="font-mono text-[10.5px] text-ink-3">{item.caption}</p>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
