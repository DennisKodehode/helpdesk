import type { User } from "@helpdesk/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Plus } from "lucide-react";
import { useState } from "react";
import DeleteUserDialog from "@/components/DeleteUserDialog";
import UserDialog from "@/components/UserDialog";
import UsersTable from "@/components/UsersTable";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/PageHeader";

async function fetchUsers(signal?: AbortSignal): Promise<User[]> {
  const { data } = await axios.get<User[]>("/api/users", { signal });
  return data;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [dialogTarget, setDialogTarget] = useState<User | "create" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const {
    data: users = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["users"],
    queryFn: ({ signal }) => fetchUsers(signal),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 pt-11 pb-10 sm:px-6 md:px-8 md:pb-12 lg:px-12 xl:px-14">
      <PageHeader
        eyebrow="Team"
        title="Agents"
        description="Manage who can sign in to the console and reply on behalf of your support team."
        action={
          <Button onClick={() => setDialogTarget("create")}>
            <Plus />
            Add agent
          </Button>
        }
      />

      <UsersTable
        users={users}
        isPending={isPending}
        isError={isError}
        onDelete={setDeleteTarget}
        onEdit={setDialogTarget}
      />

      <UserDialog
        key={dialogTarget === "create" ? "create" : (dialogTarget?.id ?? "closed")}
        open={dialogTarget !== null}
        user={dialogTarget === "create" ? null : dialogTarget}
        onOpenChange={(open) => {
          if (!open) setDialogTarget(null);
        }}
      />

      <DeleteUserDialog
        deleteTarget={deleteTarget}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
