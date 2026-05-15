import { useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Send } from "lucide-react";
import {
  type CreateReplyData,
  type Reply,
  createReplySchema,
} from "@helpdesk/core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import FieldError from "@/components/ui/FieldError";
import ErrorAlert from "@/components/ui/ErrorAlert";

interface Props {
  ticketId: string;
}

export default function ReplyForm({ ticketId }: Props) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateReplyData>({
    resolver: standardSchemaResolver(createReplySchema),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateReplyData) =>
      axios.post<Reply>(`/api/tickets/${ticketId}/replies`, data),
    onSuccess: () => {
      reset();
      setIsPolished(false);
      setRefinementNote("");
      queryClient.invalidateQueries({ queryKey: ["ticket-replies", ticketId] });
    },
  });

  const bodyValue = watch("body");

  const [isPolished, setIsPolished] = useState(false);
  const [refinementNote, setRefinementNote] = useState("");

  const polishMutation = useMutation({
    mutationFn: ({
      body,
      refinementNote,
    }: {
      body: string;
      refinementNote?: string;
    }) =>
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

  return (
    <form
      aria-label="Reply form"
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="hairline-b flex items-center justify-between bg-muted/30 px-4 py-2.5">
        <h2 className="eyebrow">Compose reply</h2>
        {isPolished && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-primary">
            <Sparkles className="size-2.5" />
            Polished
          </span>
        )}
      </div>

      <div className="space-y-3 p-4 xl:p-6 2xl:p-8">
        <Textarea
          id="reply-body"
          aria-label="Reply body"
          placeholder="Write your reply…"
          rows={5}
          className="resize-y border-border/60 bg-background text-[14px] leading-relaxed"
          {...register("body")}
        />
        <FieldError message={errors.body?.message} />

        {polishMutation.isError && (
          <ErrorAlert message="Failed to polish reply. Please try again." />
        )}

        {isPolished && (
          <Textarea
            className="field-sizing-fixed resize-y border-border/60 bg-background text-[13px]"
            aria-label="Refinement note"
            placeholder="Not quite right? Describe what to improve…"
            rows={2}
            value={refinementNote}
            onChange={(e) => setRefinementNote(e.target.value)}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
            {isPolished ? (
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
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !bodyValue?.trim()}
          >
            <Send />
            {mutation.isPending ? "Sending…" : "Send reply"}
          </Button>
        </div>
      </div>
    </form>
  );
}
