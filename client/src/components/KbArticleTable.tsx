import { type KbArticle, KbArticleSource, KbArticleStatus } from "@helpdesk/core";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, formatRelative } from "@/lib/ticket-ui";

const STATUS_STYLES: Record<KbArticleStatus, string> = {
  [KbArticleStatus.published]: "bg-eme-tint text-eme-ink border-transparent",
  [KbArticleStatus.draft]: "bg-amb-tint text-amb-ink border-transparent",
  [KbArticleStatus.archived]: "bg-panel-2 text-ink-4 border-hairline-strong",
};

const SOURCE_LABELS: Record<KbArticleSource, string> = {
  [KbArticleSource.seed]: "Seed",
  [KbArticleSource.manual]: "Manual",
  [KbArticleSource.ai_suggested]: "AI",
};

function StatusPill({ status }: { status: KbArticleStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function categoryLabel(category: KbArticle["category"]): string {
  return category ? CATEGORY_LABELS[category] : "General";
}

interface Props {
  articles: KbArticle[];
  isPending: boolean;
  isError: boolean;
  onEdit: (article: KbArticle) => void;
  onArchiveToggle: (article: KbArticle) => void;
  onDelete: (article: KbArticle) => void;
  emptyTitle?: string;
}

const NUM = "px-4 py-[15px] text-right font-mono tabular text-[14px]";

export default function KbArticleTable({
  articles,
  isPending,
  isError,
  onEdit,
  onArchiveToggle,
  onDelete,
  emptyTitle = "No articles match this view.",
}: Props) {
  if (isError) return <ErrorAlert message="Failed to load the knowledge base" />;

  function RowActions({ article }: { article: KbArticle }) {
    const archived = article.status === KbArticleStatus.archived;
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          aria-label={`Edit ${article.title}`}
          title="Edit"
          onClick={() => onEdit(article)}
          className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-foreground"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={archived ? `Restore ${article.title}` : `Archive ${article.title}`}
          title={archived ? "Restore" : "Archive"}
          onClick={() => onArchiveToggle(article)}
          className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-foreground"
        >
          {archived ? (
            <ArchiveRestore className="size-4" aria-hidden />
          ) : (
            <Archive className="size-4" aria-hidden />
          )}
        </button>
        <button
          type="button"
          aria-label={`Delete ${article.title}`}
          title="Delete"
          onClick={() => onDelete(article)}
          className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-ros-tint hover:text-ros-ink"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table — lg+ */}
      <div className="hidden overflow-x-auto rounded-[var(--r-lg)] border border-border bg-card lg:block">
        <table className="min-w-[860px] w-full border-collapse">
          <thead>
            <tr className="hairline-b bg-panel-2">
              {["Article", "Category", "Status", "Source"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground first:pl-[18px]"
                >
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Hits
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Updated
              </th>
              <th className="w-[140px]" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                <tr key={i} className="hairline-b">
                  <td className="px-4 py-[15px] pl-[18px]">
                    <Skeleton className="h-9 w-64" />
                  </td>
                  {Array.from({ length: 5 }).map((__, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                    <td key={j} className="px-4 py-[15px]">
                      <Skeleton className="h-4 w-16" />
                    </td>
                  ))}
                </tr>
              ))
            ) : articles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <p className="display-serif text-2xl text-muted-foreground">
                    {emptyTitle}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground/70">
                    Try clearing a filter, or add an article.
                  </p>
                </td>
              </tr>
            ) : (
              articles.map((a) => (
                <tr key={a.id} className="hairline-b transition-colors hover:bg-panel-2">
                  <td className="px-4 py-[15px] pl-[18px]">
                    <div className="min-w-0">
                      <div className="text-[14.5px] font-semibold text-foreground">
                        {a.title}
                      </div>
                      <div className="truncate text-[12.5px] text-ink-4">
                        {a.question}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-[15px] text-[13px] text-ink-2">
                    {categoryLabel(a.category)}
                  </td>
                  <td className="px-4 py-[15px]">
                    <StatusPill status={a.status} />
                  </td>
                  <td className="px-4 py-[15px] font-mono text-[11.5px] text-ink-3">
                    {SOURCE_LABELS[a.source]}
                  </td>
                  <td className={`${NUM} ${a.hitCount ? "text-ink-2" : "text-ink-4"}`}>
                    {a.hitCount}
                  </td>
                  <td className="px-4 py-[15px] font-mono text-[12px] whitespace-nowrap text-ink-3">
                    {formatRelative(a.updatedAt)}
                  </td>
                  <td className="px-4 py-[15px]">
                    <RowActions article={a} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — below lg */}
      <ul className="space-y-2 lg:hidden">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            <li key={i}>
              <Skeleton className="h-24 w-full rounded-[var(--r-lg)]" />
            </li>
          ))
        ) : articles.length === 0 ? (
          <li className="rounded-[var(--r-lg)] border border-border bg-card p-8 text-center">
            <p className="display-serif text-2xl text-muted-foreground">{emptyTitle}</p>
          </li>
        ) : (
          articles.map((a) => (
            <li
              key={a.id}
              className="rounded-[var(--r-lg)] border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14.5px] font-semibold text-foreground">
                    {a.title}
                  </div>
                  <div className="truncate text-[12.5px] text-ink-4">{a.question}</div>
                </div>
                <StatusPill status={a.status} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-4 font-mono text-[12px] text-ink-3">
                  <span>{categoryLabel(a.category)}</span>
                  <span>{a.hitCount} hits</span>
                </div>
                <RowActions article={a} />
              </div>
            </li>
          ))
        )}
      </ul>
    </>
  );
}
