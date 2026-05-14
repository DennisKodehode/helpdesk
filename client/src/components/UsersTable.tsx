import { Role, type User } from "@helpdesk/core";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface UsersTableProps {
  users: User[];
  isPending: boolean;
  isError: boolean;
  onDelete: (user: User) => void;
  onEdit: (user: User) => void;
}

export function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === Role.admin;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${
        isAdmin
          ? "bg-primary/8 text-primary border-primary/25"
          : "bg-transparent text-muted-foreground border-border"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block size-1.5 rounded-full ${
          isAdmin ? "bg-primary" : "bg-muted-foreground/50"
        }`}
      />
      {isAdmin ? "Admin" : "Agent"}
    </span>
  );
}

function ActionButtons({
  user,
  onEdit,
  onDelete,
}: {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Edit"
        onClick={() => onEdit(user)}
      >
        <Pencil />
      </Button>
      {user.role !== Role.admin ? (
        <Button
          variant="destructive"
          size="icon-sm"
          aria-label="Delete"
          onClick={() => onDelete(user)}
        >
          <Trash2 />
        </Button>
      ) : (
        <div className="size-7" />
      )}
    </div>
  );
}

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UsersTable({
  users,
  isPending,
  isError,
  onDelete,
  onEdit,
}: UsersTableProps) {
  if (isError) {
    return <ErrorAlert message="Failed to load users" />;
  }

  const headers = ["Name", "Email", "Role", "Joined", ""];

  return (
    <>
      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <table className="min-w-full">
          <thead>
            <tr className="hairline-b">
              {headers.map((h) => (
                <th
                  key={h || "actions"}
                  className="px-5 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="hairline-b">
                  <td className="px-5 py-3.5"><Skeleton className="h-3.5 w-32" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-3.5 w-48" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-5 py-3.5"><Skeleton className="h-3.5 w-20" /></td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Skeleton className="h-7 w-7" />
                      <Skeleton className="h-7 w-7" />
                    </div>
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <p className="display-serif text-2xl text-muted-foreground">
                    No agents yet
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground/70">
                    Add your first teammate to get started.
                  </p>
                </td>
              </tr>
            ) : (
              users.map((user, idx, arr) => (
                <tr
                  key={user.id}
                  className={`group transition-colors hover:bg-accent/40 ${
                    idx < arr.length - 1 ? "hairline-b" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                        {user.name?.trim().charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[13.5px] font-medium text-foreground">
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[12px] text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="px-5 py-3.5">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-5 py-3.5 font-mono tabular text-[12px] text-muted-foreground">
                    {formatJoined(user.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <ActionButtons user={user} onEdit={onEdit} onDelete={onDelete} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden">
        {isPending ? (
          <ul className="space-y-2" aria-label="Loading agents">
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={`m-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Skeleton className="h-7 w-7" />
                  <Skeleton className="h-7 w-7" />
                </div>
              </li>
            ))}
          </ul>
        ) : users.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="display-serif text-2xl text-muted-foreground">
              No agents yet
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground/70">
              Add your first teammate to get started.
            </p>
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Agents">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-medium text-muted-foreground">
                    {user.name?.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-foreground">
                      {user.name}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="mt-1.5">
                      <RoleBadge role={user.role} />
                    </div>
                  </div>
                </div>
                <ActionButtons user={user} onEdit={onEdit} onDelete={onDelete} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
