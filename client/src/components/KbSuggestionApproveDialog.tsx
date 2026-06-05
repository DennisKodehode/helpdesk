import {
  type ApproveKbSuggestionData,
  approveKbSuggestionSchema,
  KbArticleStatus,
  type KbSuggestion,
  TicketCategory,
} from "@helpdesk/core";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import axios from "axios";
import { Check } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FieldError from "@/components/ui/FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApproveKbSuggestion } from "@/lib/kb";
import { CATEGORY_LABELS } from "@/lib/ticket-ui";

interface Props {
  suggestion: KbSuggestion | null;
  onOpenChange: (open: boolean) => void;
  onApproved: (message: string) => void;
}

const GENERAL = "__general__";

export default function KbSuggestionApproveDialog({
  suggestion,
  onOpenChange,
  onApproved,
}: Props) {
  const approve = useApproveKbSuggestion();
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<ApproveKbSuggestionData>({
    resolver: standardSchemaResolver(approveKbSuggestionSchema),
    defaultValues: {
      title: "",
      question: "",
      answer: "",
      category: null,
      status: KbArticleStatus.published,
    },
  });

  // Prefill from the suggestion each time the dialog opens for a new one.
  useEffect(() => {
    if (!suggestion) return;
    reset({
      title: suggestion.title,
      question: suggestion.question,
      answer: suggestion.answer,
      category: suggestion.category,
      status: KbArticleStatus.published,
    });
  }, [suggestion, reset]);

  function onSubmit(data: ApproveKbSuggestionData) {
    if (!suggestion) return;
    approve.mutate(
      { id: suggestion.id, data },
      {
        onSuccess: () => {
          onApproved("Suggestion approved and published.");
          onOpenChange(false);
        },
        onError: (err) => {
          if (axios.isAxiosError(err)) {
            setError("title", {
              message: err.response?.data?.error ?? "Something went wrong",
            });
          }
        },
      },
    );
  }

  return (
    <Dialog open={suggestion !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <p className="eyebrow mb-2">Knowledge base · review</p>
          <DialogTitle className="display-serif text-[28px] leading-tight">
            Review suggestion
          </DialogTitle>
          <p className="mt-2 text-[14px] text-ink-3">
            Edit anything below before it's published. Approving creates a knowledge-base
            article the AI can ground replies on.
          </p>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-4 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-title">Title</Label>
            <Input id="ap-title" aria-invalid={!!errors.title} {...register("title")} />
            <FieldError message={errors.title?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-question">Question / trigger</Label>
            <Input
              id="ap-question"
              aria-invalid={!!errors.question}
              {...register("question")}
            />
            <FieldError message={errors.question?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-answer">Answer</Label>
            <Textarea
              id="ap-answer"
              rows={6}
              aria-invalid={!!errors.answer}
              {...register("answer")}
            />
            <FieldError message={errors.answer?.message} />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <Label htmlFor="ap-category">Category</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? GENERAL}
                    onValueChange={(v) =>
                      field.onChange(v === GENERAL ? null : (v as TicketCategory))
                    }
                  >
                    <SelectTrigger id="ap-category" aria-label="Category">
                      <span data-slot="select-value" className="flex flex-1 text-left">
                        {field.value
                          ? CATEGORY_LABELS[field.value]
                          : "General (all tickets)"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GENERAL}>General (all tickets)</SelectItem>
                      {Object.values(TicketCategory).map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <Label htmlFor="ap-status">Publish as</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as KbArticleStatus)}
                  >
                    <SelectTrigger id="ap-status" aria-label="Publish as">
                      <span
                        data-slot="select-value"
                        className="flex flex-1 text-left capitalize"
                      >
                        {field.value}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={KbArticleStatus.published}>Published</SelectItem>
                      <SelectItem value={KbArticleStatus.draft}>Draft</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={approve.isPending}>
              <Check className="size-4" aria-hidden />
              {approve.isPending ? "Approving…" : "Approve & publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
