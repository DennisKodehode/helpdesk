import type { KbArticle } from "@helpdesk/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  deleteTarget: KbArticle | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function KbDeleteDialog({
  deleteTarget,
  isDeleting,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog
      open={!!deleteTarget}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="display-serif text-2xl leading-tight xl:text-3xl 2xl:text-4xl">
            Delete article?
          </DialogTitle>
        </DialogHeader>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{deleteTarget?.title}</span> will
          be permanently removed and can no longer ground AI replies. This cannot be
          undone — to keep it for reference, archive it instead.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
