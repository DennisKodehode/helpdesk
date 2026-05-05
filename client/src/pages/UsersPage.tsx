import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UserDialog from "@/components/UserDialog";
import UsersTable from "@/components/UsersTable";
import { type User } from "@helpdesk/core";

async function fetchUsers(): Promise<User[]> {
  const { data } = await axios.get<User[]>("/api/users");
  return data;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [dialogTarget, setDialogTarget] = useState<User | "create" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { data: users = [], isPending, isError } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
  });

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
        <Button onClick={() => setDialogTarget("create")}>Add Agent</Button>
      </div>

      <UsersTable
        users={users}
        isPending={isPending}
        isError={isError}
        onDelete={setDeleteTarget}
        onEdit={setDialogTarget}
      />

      <UserDialog
        open={dialogTarget !== null}
        user={dialogTarget === "create" ? null : dialogTarget}
        onOpenChange={(open) => { if (!open) setDialogTarget(null); }}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mt-1">
            <strong className="text-gray-900">{deleteTarget?.name}</strong> (
            {deleteTarget?.email}) will be removed and lose access immediately.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
