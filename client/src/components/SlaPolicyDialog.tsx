import {
  type SlaPolicy,
  type TicketPriority,
  type UpdateSlaPolicyData,
  updateSlaPolicySchema,
} from "@helpdesk/core";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import axios from "axios";
import { useForm } from "react-hook-form";
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
import { useUpdateSlaPolicy } from "@/lib/sla-policies";
import { PRIORITY_LABELS } from "@/lib/ticket-ui";

interface SlaPolicyDialogProps {
  policy: SlaPolicy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// react-hook-form's numeric input + nullable handling is tricky: empty string
// means "clear", a typed number means "set". We coerce ourselves at submit
// time rather than fighting RHF's transforms.
type FormShape = {
  firstResponseMinutes: string;
  resolutionMinutes: string;
};

function toForm(p: SlaPolicy | null): FormShape {
  return {
    firstResponseMinutes:
      p?.firstResponseMinutes != null ? String(p.firstResponseMinutes) : "",
    resolutionMinutes: p?.resolutionMinutes != null ? String(p.resolutionMinutes) : "",
  };
}

function parseField(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export default function SlaPolicyDialog({
  policy,
  open,
  onOpenChange,
}: SlaPolicyDialogProps) {
  const updateMutation = useUpdateSlaPolicy();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormShape>({
    defaultValues: toForm(policy),
  });

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) reset(toForm(null));
  }

  async function onSubmit(values: FormShape) {
    if (!policy) return;
    const firstResponseMinutes = parseField(values.firstResponseMinutes);
    const resolutionMinutes = parseField(values.resolutionMinutes);
    if (firstResponseMinutes === undefined) {
      setError("firstResponseMinutes", { message: "Must be a number" });
      return;
    }
    if (resolutionMinutes === undefined) {
      setError("resolutionMinutes", { message: "Must be a number" });
      return;
    }
    const payload: UpdateSlaPolicyData = {
      firstResponseMinutes,
      resolutionMinutes,
    };
    // Re-validate against the shared schema so the rejection message matches
    // what the server would say (e.g. minutes must be positive integer).
    const validated = updateSlaPolicySchema.safeParse(payload);
    if (!validated.success) {
      const first = validated.error.issues[0];
      const field = first.path[0] as keyof FormShape | undefined;
      if (field === "firstResponseMinutes" || field === "resolutionMinutes") {
        setError(field, { message: first.message });
      }
      return;
    }
    try {
      await updateMutation.mutateAsync({ priority: policy.priority, data: payload });
      onOpenChange(false);
      reset(toForm(null));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError("firstResponseMinutes", {
          message: err.response?.data?.error ?? "Failed to save",
        });
      }
    }
  }

  const title = policy
    ? `Edit ${PRIORITY_LABELS[policy.priority as TicketPriority]} priority SLA`
    : "Edit SLA";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="display-serif text-2xl leading-tight xl:text-3xl 2xl:text-4xl">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-2 flex flex-col gap-4 xl:gap-5 2xl:gap-6"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstResponseMinutes">First-response target (minutes)</Label>
            <Input
              id="firstResponseMinutes"
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="Leave blank to drop this target"
              aria-invalid={!!errors.firstResponseMinutes}
              data-invalid={errors.firstResponseMinutes ? "" : undefined}
              {...register("firstResponseMinutes")}
            />
            <FieldError message={errors.firstResponseMinutes?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resolutionMinutes">Resolution target (minutes)</Label>
            <Input
              id="resolutionMinutes"
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="Leave blank to drop this target"
              aria-invalid={!!errors.resolutionMinutes}
              data-invalid={errors.resolutionMinutes ? "" : undefined}
              {...register("resolutionMinutes")}
            />
            <FieldError message={errors.resolutionMinutes?.message} />
          </div>
          <DialogFooter className="mt-2">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
