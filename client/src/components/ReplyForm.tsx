import { type CreateReplyData, createReplySchema, type Reply } from "@helpdesk/core";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
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

export default function ReplyForm({ ticketId }: Props) {
  const queryClient = useQueryClient();

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

  const mutation = useMutation({
    mutationFn: (data: CreateReplyData) =>
      axios.post<Reply>(`/api/tickets/${ticketId}/replies`, data),
    onSuccess: () => {
      reset({ body: "", isInternal: false });
      setIsPolished(false);
      setRefinementNote("");
      queryClient.invalidateQueries({ queryKey: ["ticket-replies", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticket-audit-events", ticketId] });
      queryClient.invalidateQueries({ queryKey: PERSONAL_STATS_QUERY_KEY });
    },
  });

  const bodyValue = watch("body");
  const isInternal = watch("isInternal");

  const [isPolished, setIsPolished] = useState(false);
  const [refinementNote, setRefinementNote] = useState("");

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

  return (
    <form
      aria-label="Reply form"
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className={`overflow-hidden rounded-lg border ${
        isInternal
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

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
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
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !bodyValue?.trim()}
          >
            <Send />
            {mutation.isPending
              ? isInternal
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
