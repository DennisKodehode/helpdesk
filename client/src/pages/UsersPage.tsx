import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/PageHeader";
import UserDialog from "@/components/UserDialog";
import UsersTable from "@/components/UsersTable";
import DeleteUserDialog from "@/components/DeleteUserDialog";
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
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 md:px-8 md:pt-12 md:pb-16 lg:px-10 xl:px-12 xl:pt-16 2xl:px-16 2xl:pt-20">
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
        onOpenChange={(open) => { if (!open) setDialogTarget(null); }}
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
