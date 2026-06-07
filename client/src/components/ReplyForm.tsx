import {
  ATTACHMENT_MIME_ALLOWLIST,
  type CreateReplyData,
  createReplySchema,
  MAX_ATTACHMENT_SIZE_BYTES,
  type PolishReplyResponse,
  type Reply,
} from "@helpdesk/core";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { BookOpen, ChevronDown, Paperclip, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import ErrorAlert from "@/components/ui/ErrorAlert";
import FieldError from "@/components/ui/FieldError";
import { Textarea } from "@/components/ui/textarea";
import { PERSONAL_STATS_QUERY_KEY } from "@/lib/personal-stats";
import { BADGE_BASE } from "@/lib/ticket-ui";
import { cn } from "@/lib/utils";

const COMPOSER_TABS = [
  { internal: false, label: "Reply to customer" },
  { internal: true, label: "Internal note" },
] as const;

interface Props {
  ticketId: string;
}

const MAX_FILES = 5;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Confidence pill on the AI draft card: High (emerald) / Moderate (amber) /
// Low (rose), mirroring the SLA/priority tone language.
function confidenceTone(pct: number): { label: string; cls: string } {
  if (pct >= 80) return { label: "High", cls: "bg-eme-bg text-eme-fg border-eme-dot/30" };
  if (pct >= 65)
    return { label: "Moderate", cls: "bg-amb-bg text-amb-fg border-amb-dot/30" };
  return { label: "Low", cls: "bg-ros-bg text-ros-fg border-ros-dot/35" };
}

export default function ReplyForm({ ticketId }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateReplyData>({
    resolver: standardSchemaResolver(createReplySchema),
    defaultValues: { body: "", isInternal: false },
  });

  // Each picked file gets a stable random ID at pick time so chip keys don't
  // collide when the same filename is picked twice (and we don't fall back to
  // an array index — biome's noArrayIndexKey rule and React's reconciler both
  // dislike that).
  const [pickedFiles, setPickedFiles] = useState<{ id: string; file: File }[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPolished, setIsPolished] = useState(false);
  const [refinementNote, setRefinementNote] = useState("");
  const [isRefineOpen, setIsRefineOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: CreateReplyData) => {
      const fd = new FormData();
      fd.append("body", data.body);
      fd.append("isInternal", String(data.isInternal));
      for (const { file } of pickedFiles) fd.append("files", file);
      return axios.post<Reply>(`/api/tickets/${ticketId}/replies`, fd);
    },
    onSuccess: () => {
      reset({ body: "", isInternal: false });
      setIsPolished(false);
      setRefinementNote("");
      setPickedFiles([]);
      setAttachmentError(null);
      queryClient.invalidateQueries({ queryKey: ["ticket-replies", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticket-audit-events", ticketId] });
      queryClient.invalidateQueries({ queryKey: PERSONAL_STATS_QUERY_KEY });
    },
  });

  const bodyValue = watch("body");
  const isInternal = watch("isInternal");

  // "Polish" sends the agent's draft to the KB-grounded review endpoint and
  // surfaces the result in a card (preview + confidence + cited sources). The
  // agent iterates on it in-card via Refine and applies it explicitly — Polish
  // never overwrites the composer on its own. Each fresh result clears + closes
  // the refine editor so the new draft is what's on screen.
  const polishMutation = useMutation({
    mutationFn: ({ body, refinementNote }: { body: string; refinementNote?: string }) =>
      axios
        .post<PolishReplyResponse>(`/api/tickets/${ticketId}/polish-reply`, {
          body,
          refinementNote,
        })
        .then((r) => r.data),
    onSuccess: () => {
      setRefinementNote("");
      setIsRefineOpen(false);
    },
  });

  function dismissPolish() {
    polishMutation.reset();
    setRefinementNote("");
    setIsRefineOpen(false);
  }

  // Apply the card's polished reply to the composer. The textarea stays fully
  // editable, so this is the single apply action (no separate "edit" variant);
  // focus lands in the textarea for any final touch-ups.
  function usePolishedReply() {
    const draft = polishMutation.data?.body;
    if (!draft) return;
    setValue("body", draft, { shouldValidate: true, shouldDirty: true });
    setIsPolished(true);
    dismissPolish();
    document.getElementById("reply-body")?.focus();
  }

  // Refine the card's *current* draft (not the composer) using the agent's note,
  // so they can iterate before committing. The refined result replaces the card.
  function refineDraft() {
    const draft = polishMutation.data?.body;
    if (!draft || !refinementNote.trim()) return;
    polishMutation.mutate({ body: draft, refinementNote });
  }

  useEffect(() => {
    if (isPolished && !bodyValue?.trim()) {
      setIsPolished(false);
    }
  }, [bodyValue, isPolished]);

  useEffect(() => {
    if (isInternal) {
      setIsPolished(false);
      setRefinementNote("");
    }
  }, [isInternal]);

  function addFiles(incoming: File[]) {
    setAttachmentError(null);
    const accepted: { id: string; file: File }[] = [];
    for (const f of incoming) {
      if (!ATTACHMENT_MIME_ALLOWLIST.includes(f.type)) {
        setAttachmentError(
          `Skipped ${f.name}: file type "${f.type || "unknown"}" is not allowed.`,
        );
        continue;
      }
      if (f.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setAttachmentError(`Skipped ${f.name}: exceeds 10 MB.`);
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file: f });
    }
    setPickedFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (accepted.length > remaining) {
        setAttachmentError(
          `Only ${remaining} more file${remaining === 1 ? "" : "s"} can be attached (5 max per reply).`,
        );
      }
      return [...prev, ...accepted.slice(0, remaining)];
    });
  }

  function removeFile(id: string) {
    setPickedFiles((prev) => prev.filter((entry) => entry.id !== id));
    setAttachmentError(null);
  }

  function handleDrop(e: React.DragEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }

  const hasFiles = pickedFiles.length > 0;
  const submitDisabled = mutation.isPending || (!bodyValue?.trim() && !hasFiles);

  return (
    <form
      aria-label="Reply form"
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`overflow-hidden rounded-[var(--r-lg)] border transition-colors ${
        isDragOver
          ? "border-primary/60 ring-2 ring-primary/20"
          : isInternal
            ? "border-amb-dot/45 bg-amb-bg/50"
            : "border-border bg-card"
      }`}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b border-border px-4",
          isInternal ? "bg-amb-bg" : "bg-panel-2",
        )}
      >
        {/* Underlined tabs — active tab gets a violet bottom border that
            overlaps the row's hairline (the prototype's composer style). */}
        <Controller
          name="isInternal"
          control={control}
          render={({ field }) => (
            <div role="tablist" aria-label="Reply visibility" className="flex gap-4">
              {COMPOSER_TABS.map((tab) => {
                const active = field.value === tab.internal;
                return (
                  <button
                    key={tab.label}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      field.onChange(tab.internal);
                      // Switching to an internal note hides the polish card —
                      // drop its (now-irrelevant) state so it can't reappear.
                      if (tab.internal) dismissPolish();
                    }}
                    className={cn(
                      "-mb-px border-b-2 py-2.5 text-[13px] transition-colors",
                      active
                        ? "border-primary font-semibold text-foreground"
                        : "border-transparent text-ink-3 hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        />
        {isPolished && !isInternal && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-accent-ink">
            <Sparkles className="size-2.5" />
            Polished
          </span>
        )}
      </div>

      <div className="space-y-3 p-4 xl:p-6 2xl:p-8">
        <Textarea
          id="reply-body"
          aria-label={isInternal ? "Internal note body" : "Reply body"}
          placeholder={isInternal ? "Visible to other agents only…" : "Write your reply…"}
          rows={5}
          className={cn(
            "resize-y text-[14px] leading-relaxed",
            isInternal
              ? "border-amb-dot/40 bg-amb-bg/50"
              : "border-border/60 bg-background",
          )}
          {...register("body")}
        />
        <FieldError message={errors.body?.message} />

        {!isInternal && (polishMutation.isPending || polishMutation.data) && (
          <div className="ai-surface rounded-[var(--r-md)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="ai-chip">
                <Sparkles className="size-3" aria-hidden /> Polished reply
              </p>
              <div className="flex items-center gap-2">
                {polishMutation.data && (
                  <span
                    className={`${BADGE_BASE} ${confidenceTone(polishMutation.data.confidence).cls}`}
                  >
                    {confidenceTone(polishMutation.data.confidence).label} ·{" "}
                    {Math.round(polishMutation.data.confidence)}%
                  </span>
                )}
                {polishMutation.data && (
                  <button
                    type="button"
                    aria-label="Dismiss polished reply"
                    onClick={dismissPolish}
                    className="rounded-full p-0.5 text-ink-3 hover:bg-panel-2 hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {polishMutation.isPending ? (
              <div
                className="mt-3 space-y-2"
                role="status"
                aria-label="Polishing your reply"
              >
                <div className="shimmer h-3 w-[92%] rounded" />
                <div className="shimmer h-3 w-full rounded" />
                <div className="shimmer h-3 w-[70%] rounded" />
              </div>
            ) : polishMutation.data ? (
              <div className="mt-3">
                <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-foreground">
                  {polishMutation.data.body}
                </p>
                {polishMutation.data.changeSummary && (
                  <p className="mt-2.5 text-[12.5px] text-accent-ink">
                    {polishMutation.data.changeSummary}
                  </p>
                )}
                {polishMutation.data.sources.length > 0 && (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">
                      <BookOpen className="size-3" aria-hidden /> Sources used
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {polishMutation.data.sources.map((s) => (
                        <li key={s.id} className="text-[12.5px] text-foreground">
                          {s.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={usePolishedReply}
                  >
                    Use this reply
                  </Button>
                  {/* Disclosure toggle — keeps the card calm until the agent
                      wants to iterate. Opens an in-card "what should change?"
                      field that re-polishes this draft (not the composer). */}
                  <button
                    type="button"
                    aria-expanded={isRefineOpen}
                    aria-controls="refine-panel"
                    onClick={() => setIsRefineOpen((open) => !open)}
                    className="ml-1 inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2 py-1 text-[13px] font-medium text-accent-ink hover:bg-accent-tint"
                  >
                    Refine
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform",
                        isRefineOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                </div>

                {isRefineOpen && (
                  <div id="refine-panel" className="mt-3 border-t border-border/50 pt-3">
                    <label
                      htmlFor="refine-note"
                      className="text-[12.5px] font-medium text-foreground"
                    >
                      What should change?
                    </label>
                    <Textarea
                      id="refine-note"
                      aria-label="What should change?"
                      placeholder="e.g. too formal — shorten it, lead with the refund steps…"
                      rows={2}
                      className="mt-1.5 field-sizing-fixed resize-y border-border/60 bg-background text-[13px]"
                      value={refinementNote}
                      onChange={(e) => setRefinementNote(e.target.value)}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        disabled={!refinementNote.trim() || polishMutation.isPending}
                        onClick={refineDraft}
                      >
                        <Sparkles />
                        Refine draft
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {polishMutation.isError && (
          <ErrorAlert message="Failed to polish reply. Please try again." />
        )}

        {attachmentError && <ErrorAlert message={attachmentError} />}

        {hasFiles && (
          <ul aria-label="Attached files" className="flex flex-wrap gap-2">
            {pickedFiles.map(({ id, file }) => (
              <li
                key={id}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-panel-2 px-3 py-1 text-[12px]"
              >
                <Paperclip className="size-3 text-muted-foreground" aria-hidden />
                <span className="max-w-[180px] truncate font-medium text-foreground">
                  {file.name}
                </span>
                <span className="text-muted-foreground/80">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeFile(id)}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ATTACHMENT_MIME_ALLOWLIST.join(",")}
          className="hidden"
          aria-hidden
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFiles(Array.from(e.target.files));
            }
            // Reset value so picking the same file twice still fires onChange
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Attach files"
              disabled={pickedFiles.length >= MAX_FILES}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip />
              Attach
            </Button>
            {/* Polish reviews the agent's draft against the knowledge base. It's
                an AI moment → quiet accent-tinted outline, distinct from the ink
                Send. While the polish card is open, iteration happens there
                (Use / Refine), so the toolbar entry point steps aside. */}
            {!isInternal && !polishMutation.isPending && !polishMutation.data && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-primary/30 text-accent-ink hover:bg-accent-tint hover:text-accent-ink"
                disabled={!bodyValue?.trim()}
                onClick={() => polishMutation.mutate({ body: bodyValue })}
              >
                <Sparkles />
                Polish with AI
              </Button>
            )}
          </div>
          <Button type="submit" size="sm" disabled={submitDisabled}>
            <Send />
            {mutation.isPending
              ? hasFiles
                ? "Uploading…"
                : isInternal
                  ? "Adding…"
                  : "Sending…"
              : isInternal
                ? "Add note"
                : "Send reply"}
          </Button>
        </div>
      </div>
    </form>
  );
}
