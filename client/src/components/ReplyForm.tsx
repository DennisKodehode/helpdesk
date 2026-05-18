import {
  ATTACHMENT_MIME_ALLOWLIST,
  type CreateReplyData,
  createReplySchema,
  MAX_ATTACHMENT_SIZE_BYTES,
  type Reply,
} from "@helpdesk/core";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Paperclip, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import ErrorAlert from "@/components/ui/ErrorAlert";
import FieldError from "@/components/ui/FieldError";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PERSONAL_STATS_QUERY_KEY } from "@/lib/personal-stats";

interface Props {
  ticketId: string;
}

const MAX_FILES = 5;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

  useEffect(() => {
    if (isPolished && !bodyValue?.trim()) {
      setIsPolished(false);
      setRefinementNote("");
    }
  }, [bodyValue, isPolished]);

  useEffect(() => {
    if (isInternal) {
      setIsPolished(false);
      setRefinementNote("");
    }
  }, [isInternal]);

  const polishMutation = useMutation({
    mutationFn: ({ body, refinementNote }: { body: string; refinementNote?: string }) =>
      axios.post<{ body: string }>(`/api/tickets/${ticketId}/polish-reply`, {
        body,
        refinementNote,
      }),
    onSuccess: ({ data }) => {
      setValue("body", data.body, { shouldValidate: true, shouldDirty: true });
      setIsPolished(true);
      setRefinementNote("");
    },
  });

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
      className={`overflow-hidden rounded-lg border transition-colors ${
        isDragOver
          ? "border-primary/60 ring-2 ring-primary/20"
          : isInternal
            ? "border-amber-300/70 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20"
            : "border-border bg-card"
      }`}
    >
      <div
        className={`hairline-b flex items-center justify-between px-4 py-2.5 ${
          isInternal ? "bg-amber-100/40 dark:bg-amber-950/30" : "bg-muted/30"
        }`}
      >
        <Controller
          name="isInternal"
          control={control}
          render={({ field }) => (
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={field.value ? ["internal"] : ["customer"]}
              onValueChange={(values: string[]) => {
                const next = values[0];
                if (next) field.onChange(next === "internal");
              }}
              aria-label="Reply visibility"
            >
              <ToggleGroupItem value="customer">Reply to customer</ToggleGroupItem>
              <ToggleGroupItem value="internal">Internal note</ToggleGroupItem>
            </ToggleGroup>
          )}
        />
        {isPolished && !isInternal && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-primary">
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
          className="resize-y border-border/60 bg-background text-[14px] leading-relaxed"
          {...register("body")}
        />
        <FieldError message={errors.body?.message} />

        {polishMutation.isError && (
          <ErrorAlert message="Failed to polish reply. Please try again." />
        )}

        {attachmentError && <ErrorAlert message={attachmentError} />}

        {hasFiles && (
          <ul aria-label="Attached files" className="flex flex-wrap gap-2">
            {pickedFiles.map(({ id, file }) => (
              <li
                key={id}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[12px]"
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

        {isPolished && !isInternal && (
          <Textarea
            className="field-sizing-fixed resize-y border-border/60 bg-background text-[13px]"
            aria-label="Refinement note"
            placeholder="Not quite right? Describe what to improve…"
            rows={2}
            value={refinementNote}
            onChange={(e) => setRefinementNote(e.target.value)}
          />
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
            {!isInternal &&
              (isPolished ? (
                <Button
                  type="button"
                  variant={refinementNote.trim() ? "default" : "outline"}
                  size="sm"
                  disabled={!refinementNote.trim() || polishMutation.isPending}
                  onClick={() =>
                    polishMutation.mutate({ body: bodyValue, refinementNote })
                  }
                >
                  <Sparkles />
                  {polishMutation.isPending ? "Refining…" : "Refine"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!bodyValue?.trim() || polishMutation.isPending}
                  onClick={() => polishMutation.mutate({ body: bodyValue })}
                >
                  <Sparkles />
                  {polishMutation.isPending ? "Polishing…" : "Polish with AI"}
                </Button>
              ))}
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
