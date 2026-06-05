import type { KbSuggestion } from "@helpdesk/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  suggestion: KbSuggestion | null;
  isRejecting: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export default function KbSuggestionRejectDialog({
  suggestion,
  isRejecting,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={!!suggestion}
      onOpenChange={(open) => {
        if (!open) {
          setReason("");
          onCancel();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="display-serif text-2xl leading-tight">
            Reject suggestion?
          </DialogTitle>
        </DialogHeader>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{suggestion?.title}</span> won't
          become an article. Optionally note why, for the audit trail.
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="reject-reason">Reason (optional)</Label>
          <Textarea
            id="reject-reason"
            rows={3}
            maxLength={500}
            placeholder="e.g. Already covered by an existing article."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setReason("");
              onCancel();
            }}
            disabled={isRejecting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm(reason.trim());
              setReason("");
            }}
            disabled={isRejecting}
          >
            {isRejecting ? "Rejecting…" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
