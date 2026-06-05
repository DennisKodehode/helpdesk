import { type KbArticle, KbArticleStatus, TicketCategory } from "@helpdesk/core";
import axios from "axios";
import { BookPlus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AgentToast from "@/components/AgentToast";
import KbArticleDialog from "@/components/KbArticleDialog";
import KbArticleTable from "@/components/KbArticleTable";
import KbDeleteDialog from "@/components/KbDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useDeleteKbArticle, useKbArticles, useUpdateKbArticle } from "@/lib/kb";
import { CATEGORY_LABELS } from "@/lib/ticket-ui";

function errorMessage(err: unknown): string {
  return axios.isAxiosError(err)
    ? (err.response?.data?.error ?? "Something went wrong")
    : "Something went wrong";
}

const GENERAL = "__general__";

export default function KbArticlesView() {
  const { data: articles = [], isPending, isError } = useKbArticles();
  const updateArticle = useUpdateKbArticle();
  const deleteArticle = useDeleteKbArticle();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KbArticle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KbArticle | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (categoryFilter) {
        if (
          categoryFilter === GENERAL ? a.category !== null : a.category !== categoryFilter
        )
          return false;
      }
      if (
        q &&
        !(a.title.toLowerCase().includes(q) || a.question.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [articles, query, statusFilter, categoryFilter]);

  function openCreate() {
    setEditTarget(null);
    setDialogOpen(true);
  }

  function openEdit(article: KbArticle) {
    setEditTarget(article);
    setDialogOpen(true);
  }

  function handleArchiveToggle(article: KbArticle) {
    const next =
      article.status === KbArticleStatus.archived
        ? KbArticleStatus.published
        : KbArticleStatus.archived;
    updateArticle.mutate(
      { id: article.id, data: { status: next } },
      {
        onSuccess: () =>
          setFlash(
            next === KbArticleStatus.archived ? "Article archived." : "Article restored.",
          ),
        onError: (err) => setFlash(errorMessage(err)),
      },
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteArticle.mutate(deleteTarget.id, {
      onSuccess: () => {
        setFlash("Article deleted.");
        setDeleteTarget(null);
      },
      onError: (err) => {
        setFlash(errorMessage(err));
        setDeleteTarget(null);
      },
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search
            aria-hidden
            className="absolute top-1/2 left-[13px] size-4 -translate-y-1/2 text-ink-4"
          />
          <Input
            placeholder="Search by title or question…"
            aria-label="Search articles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-[38px]"
          />
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger
            aria-label="Filter by status"
            className="h-10 w-auto min-w-[130px] text-[13px]"
          >
            <span data-slot="select-value" className="flex flex-1 text-left capitalize">
              {statusFilter || "All statuses"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value={KbArticleStatus.published}>Published</SelectItem>
            <SelectItem value={KbArticleStatus.draft}>Draft</SelectItem>
            <SelectItem value={KbArticleStatus.archived}>Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter || "all"}
          onValueChange={(v) => setCategoryFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger
            aria-label="Filter by category"
            className="h-10 w-auto min-w-[140px] text-[13px]"
          >
            <span data-slot="select-value" className="flex flex-1 text-left">
              {categoryFilter === GENERAL
                ? "General"
                : categoryFilter
                  ? CATEGORY_LABELS[categoryFilter as TicketCategory]
                  : "All categories"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value={GENERAL}>General</SelectItem>
            {Object.values(TicketCategory).map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate}>
          <BookPlus className="size-4" aria-hidden /> New article
        </Button>
      </div>

      <KbArticleTable
        articles={filtered}
        isPending={isPending}
        isError={isError}
        onEdit={openEdit}
        onArchiveToggle={handleArchiveToggle}
        onDelete={setDeleteTarget}
      />

      {!isPending && !isError && (
        <p className="mt-4 font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-4">
          {filtered.length} {filtered.length === 1 ? "article" : "articles"} shown
        </p>
      )}

      <KbArticleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        article={editTarget}
        onSaved={setFlash}
      />
      <KbDeleteDialog
        deleteTarget={deleteTarget}
        isDeleting={deleteArticle.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <AgentToast message={flash} />
    </>
  );
}
