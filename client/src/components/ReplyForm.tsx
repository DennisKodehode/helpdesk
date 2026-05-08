import axios from "axios";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type CreateReplyData, type Reply, createReplySchema } from "@helpdesk/core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import FieldError from "@/components/ui/FieldError";

interface Props {
  ticketId: string;
}

export default function ReplyForm({ ticketId }: Props) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateReplyData>({
    resolver: standardSchemaResolver(createReplySchema),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateReplyData) =>
      axios.post<Reply>(`/api/tickets/${ticketId}/replies`, data),
    onSuccess: () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ["ticket-replies", ticketId] });
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
      <Button type="submit" disabled={mutation.isPending} className="mt-1">
        {mutation.isPending ? "Sending…" : "Send Reply"}
      </Button>
    </form>
  );
}
