import {
  type CreateKbArticleData,
  createKbArticleSchema,
  type KbArticle,
  KbArticleStatus,
  TicketCategory,
} from "@helpdesk/core";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import axios from "axios";
import { Save } from "lucide-react";
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
import { useCreateKbArticle, useUpdateKbArticle } from "@/lib/kb";
import { CATEGORY_LABELS } from "@/lib/ticket-ui";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When set, the dialog edits this article; otherwise it creates a new one.
  article: KbArticle | null;
  onSaved: (message: string) => void;
}

// Sentinel mapping the "General" select option to a null category.
const GENERAL = "__general__";

const CREATE_DEFAULTS: CreateKbArticleData = {
  title: "",
  question: "",
  answer: "",
  category: null,
  status: KbArticleStatus.published,
};

export default function KbArticleDialog({ open, onOpenChange, article, onSaved }: Props) {
  const create = useCreateKbArticle();
  const update = useUpdateKbArticle();
  const isEdit = article !== null;
  const isPending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateKbArticleData>({
    resolver: standardSchemaResolver(createKbArticleSchema),
    defaultValues: CREATE_DEFAULTS,
  });

  // Re-seed the form whenever the dialog opens (for a fresh create) or the
  // target article changes (for edit). An archived article maps to "published"
  // since the form only offers draft/published — saving restores it.
  useEffect(() => {
    if (!open) return;
    if (article) {
      reset({
        title: article.title,
        question: article.question,
        answer: article.answer,
        category: article.category,
        status:
          article.status === KbArticleStatus.draft
            ? KbArticleStatus.draft
            : KbArticleStatus.published,
      });
    } else {
      reset(CREATE_DEFAULTS);
    }
  }, [open, article, reset]);

  function onSubmit(data: CreateKbArticleData) {
    const onError = (err: unknown) => {
      if (axios.isAxiosError(err)) {
        setError("title", {
          message: err.response?.data?.error ?? "Something went wrong",
        });
      }
    };
    if (isEdit && article) {
      update.mutate(
        { id: article.id, data },
        {
          onSuccess: () => {
            onSaved("Article updated.");
            onOpenChange(false);
          },
          onError,
        },
      );
    } else {
      create.mutate(data, {
        onSuccess: () => {
          onSaved("Article created.");
          onOpenChange(false);
        },
        onError,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <p className="eyebrow mb-2">Knowledge base</p>
          <DialogTitle className="display-serif text-[28px] leading-tight">
            {isEdit ? "Edit article" : "New article"}
          </DialogTitle>
          <p className="mt-2 text-[14px] text-ink-3">
            Published articles ground the AI's replies for matching ticket categories.
            General articles (no category) apply to every ticket.
          </p>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-4 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kb-title">Title</Label>
            <Input
              id="kb-title"
              placeholder="Refund policy"
              aria-invalid={!!errors.title}
              {...register("title")}
            />
            <FieldError message={errors.title?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kb-question">Question / trigger</Label>
            <Input
              id="kb-question"
              placeholder="What is the refund policy?"
              aria-invalid={!!errors.question}
              {...register("question")}
            />
            <FieldError message={errors.question?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kb-answer">Answer</Label>
            <Textarea
              id="kb-answer"
              rows={6}
              placeholder="Explain the policy the AI should follow…"
              aria-invalid={!!errors.answer}
              {...register("answer")}
            />
            <FieldError message={errors.answer?.message} />
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <Label htmlFor="kb-category">Category</Label>
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
                    <SelectTrigger id="kb-category" aria-label="Category">
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
              <Label htmlFor="kb-status">Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as KbArticleStatus)}
                  >
                    <SelectTrigger id="kb-status" aria-label="Status">
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
            <Button type="submit" variant="accent" disabled={isPending}>
              <Save className="size-4" aria-hidden />
              {isPending ? "Saving…" : isEdit ? "Save changes" : "Create article"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
