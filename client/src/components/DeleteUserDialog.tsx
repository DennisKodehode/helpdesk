import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type User } from "@helpdesk/core";

interface Props {
  deleteTarget: User | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteUserDialog({
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
            Delete agent?
          </DialogTitle>
        </DialogHeader>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            {deleteTarget?.name}
          </span>{" "}
          <span className="font-mono text-muted-foreground">
            ({deleteTarget?.email})
          </span>{" "}
          will lose access immediately. This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
