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

export default function DeleteUserDialog({ deleteTarget, isDeleting, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete user?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 mt-1">
          <strong className="text-gray-900">{deleteTarget?.name}</strong> (
          {deleteTarget?.email}) will be removed and lose access immediately.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
