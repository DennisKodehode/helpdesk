import { useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type CreateReplyData, type Reply, createReplySchema } from "@helpdesk/core";
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
    mutationFn: ({ body, refinementNote }: { body: string; refinementNote?: string }) =>
      axios.post<{ body: string }>(`/api/tickets/${ticketId}/polish-reply`, { body, refinementNote }),
    onSuccess: ({ data }) => {
      setValue("body", data.body, { shouldValidate: true, shouldDirty: true });
      setIsPolished(true);
      setRefinementNote("");
    },
  });

  return (
    <form
      aria-label="Reply form"
      className="border-t border-gray-100 pt-4 space-y-2"
      onSubmit={handleSubmit(data => mutation.mutate(data))}
    >
      <label htmlFor="reply-body" className="text-sm font-medium text-gray-700">
        Reply
      </label>
      <Textarea
        id="reply-body"
        aria-label="Reply body"
        placeholder="Write your reply…"
        rows={4}
        {...register("body")}
      />
      <FieldError message={errors.body?.message} />
      {polishMutation.isError && (
        <ErrorAlert message="Failed to polish reply. Please try again." />
      )}
      {isPolished && (
        <Textarea
          className="resize-y field-sizing-fixed"
          aria-label="Refinement note"
          placeholder="Not quite right? Describe what to improve…"
          rows={2}
          value={refinementNote}
          onChange={e => setRefinementNote(e.target.value)}
        />
      )}
      <div className="flex items-center gap-2 mt-1">
        {isPolished ? (
          <Button
            type="button"
            variant={refinementNote.trim() ? "default" : "outline"}
            disabled={!refinementNote.trim() || polishMutation.isPending}
            onClick={() => polishMutation.mutate({ body: bodyValue, refinementNote })}
          >
            {polishMutation.isPending ? "Refining…" : "Refine"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={!bodyValue?.trim() || polishMutation.isPending}
            onClick={() => polishMutation.mutate({ body: bodyValue })}
          >
            {polishMutation.isPending ? "Polishing…" : "Polish"}
          </Button>
        )}
        <Button type="submit" disabled={mutation.isPending || !bodyValue?.trim()}>
          {mutation.isPending ? "Sending…" : "Send Reply"}
        </Button>
      </div>
    </form>
  );
}
