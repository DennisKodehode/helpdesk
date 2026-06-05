import { BookText, Inbox } from "lucide-react";
import { useState } from "react";
import KbArticlesView from "@/components/KbArticlesView";
import KbSuggestionsView from "@/components/KbSuggestionsView";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import { useKbSuggestionsCount } from "@/lib/kb";
import { cn } from "@/lib/utils";

type Tab = "articles" | "suggestions";

export default function KnowledgeBasePage() {
  const [tab, setTab] = useState<Tab>("articles");
  const { data: count } = useKbSuggestionsCount(true);
  const pending = count?.pending ?? 0;

  const tabs: { value: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { value: "articles", label: "Articles", icon: <BookText className="size-3.5" /> },
    {
      value: "suggestions",
      label: "Suggestions",
      icon: <Inbox className="size-3.5" />,
      badge: pending,
    },
  ];

  return (
    <PageContainer width="queue">
      <PageHeader
        eyebrow="Administration"
        title="Knowledge base"
        description="The articles that ground the AI's replies, and the AI- and agent-proposed additions waiting for your review."
      />

      <div
        role="tablist"
        className="mb-5 inline-flex gap-[3px] rounded-[var(--r-sm)] border border-border bg-panel-2 p-[3px]"
      >
        {tabs.map((o) => {
          const active = o.value === tab;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(o.value)}
              className={cn(
                "inline-flex items-center gap-[7px] whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-card font-semibold text-ink shadow-sm"
                  : "font-medium text-ink-3 hover:text-ink-2",
              )}
            >
              {o.icon}
              {o.label}
              {o.badge ? (
                <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent-tint-2 px-1.5 font-mono text-[10px] font-medium text-accent-ink tabular leading-[18px]">
                  {o.badge > 99 ? "99+" : o.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "articles" ? <KbArticlesView /> : <KbSuggestionsView />}
    </PageContainer>
  );
}
