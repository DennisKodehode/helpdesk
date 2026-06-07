import { isGlobalAdmin, Role, type RosterAgent, UserStatus } from "@helpdesk/core";
import axios from "axios";
import { Search, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AgentRowAction } from "@/components/AgentRowMenu";
import AgentToast from "@/components/AgentToast";
import AiAutomationStrip from "@/components/AiAutomationStrip";
import DeleteUserDialog from "@/components/DeleteUserDialog";
import InviteAgentDialog from "@/components/InviteAgentDialog";
import RosterSummaryCards from "@/components/RosterSummaryCards";
import RosterTable from "@/components/RosterTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  useRemoveAgent,
  useResendInvite,
  useRoster,
  useUpdateAgentRole,
  useUpdateAgentStatus,
} from "@/lib/agents";
import { useSession } from "@/lib/auth-client";

function errorMessage(err: unknown): string {
  return axios.isAxiosError(err)
    ? (err.response?.data?.error ?? "Something went wrong")
    : "Something went wrong";
}

export default function UsersPage() {
  const { data: session } = useSession();
  const viewerIsGlobalAdmin = isGlobalAdmin(
    (session?.user as Record<string, unknown> | undefined)?.role as string | undefined,
  );
  const { data: roster = [], isPending, isError } = useRoster();
  const updateRole = useUpdateAgentRole();
  const updateStatus = useUpdateAgentStatus();
  const resendInvite = useResendInvite();
  const removeAgent = useRemoveAgent();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RosterAgent | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter((a) => {
      if (roleFilter && a.role !== roleFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (q && !(a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [roster, query, roleFilter, statusFilter]);

  function handleRoleChange(id: string, role: Role) {
    updateRole.mutate(
      { id, role },
      {
        onSuccess: () =>
          setFlash(`Role updated to ${role === Role.admin ? "Admin" : "Agent"}.`),
        onError: (err) => setFlash(errorMessage(err)),
      },
    );
  }

  function handleAction(id: string, action: AgentRowAction) {
    if (action === "remove") {
      setRemoveTarget(roster.find((a) => a.id === id) ?? null);
      return;
    }
    if (action === "resend") {
      resendInvite.mutate(id, {
        onSuccess: () => setFlash("Invitation resent."),
        onError: (err) => setFlash(errorMessage(err)),
      });
    } else {
      const status = action === "deactivate" ? UserStatus.inactive : UserStatus.active;
      updateStatus.mutate(
        { id, status },
        {
          onSuccess: () =>
            setFlash(
              action === "deactivate" ? "Agent deactivated." : "Agent reactivated.",
            ),
          onError: (err) => setFlash(errorMessage(err)),
        },
      );
    }
  }

  function confirmRemove() {
    if (!removeTarget) return;
    removeAgent.mutate(removeTarget.id, {
      onSuccess: () => {
        setFlash("Agent removed from team.");
        setRemoveTarget(null);
      },
      onError: (err) => {
        setFlash(errorMessage(err));
        setRemoveTarget(null);
      },
    });
  }

  return (
    <PageContainer width="queue">
      <PageHeader
        title="Agents"
        description="Everyone with access to the workspace. Manage roles, throughput, and access."
        action={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" aria-hidden /> Invite agent
          </Button>
        }
      />

      <RosterSummaryCards roster={roster} />

      <div className="mt-4">
        <AiAutomationStrip />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search
            aria-hidden
            className="absolute top-1/2 left-[13px] size-4 -translate-y-1/2 text-ink-4"
          />
          <Input
            placeholder="Search by name or email…"
            aria-label="Search agents"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-[38px]"
          />
        </div>
        <Select
          value={roleFilter || "all"}
          onValueChange={(v) => setRoleFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger
            aria-label="Filter by role"
            className="h-10 w-auto min-w-[130px] text-[13px]"
          >
            <span data-slot="select-value" className="flex flex-1 text-left">
              {roleFilter === Role.admin
                ? "Admins"
                : roleFilter === Role.agent
                  ? "Agents"
                  : "All roles"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value={Role.admin}>Admins</SelectItem>
            <SelectItem value={Role.agent}>Agents</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger
            aria-label="Filter by status"
            className="h-10 w-auto min-w-[130px] text-[13px]"
          >
            <span data-slot="select-value" className="flex flex-1 text-left capitalize">
              {statusFilter || "All statuses"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value={UserStatus.active}>Active</SelectItem>
            <SelectItem value={UserStatus.invited}>Invited</SelectItem>
            <SelectItem value={UserStatus.inactive}>Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <RosterTable
        roster={filtered}
        isPending={isPending}
        isError={isError}
        onRoleChange={handleRoleChange}
        onAction={handleAction}
        viewerIsGlobalAdmin={viewerIsGlobalAdmin}
      />

      {!isPending && !isError && (
        <p className="mt-4 font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-4">
          {filtered.length} {filtered.length === 1 ? "member" : "members"} shown · AI
          Agent excluded from seats
        </p>
      )}

      <InviteAgentDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        canInviteAdmins={viewerIsGlobalAdmin}
        onInvited={(email) => setFlash(`Invitation sent to ${email}.`)}
      />
      <DeleteUserDialog
        deleteTarget={removeTarget ? { ...removeTarget, createdAt: "" } : null}
        isDeleting={removeAgent.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
      <AgentToast message={flash} />
    </PageContainer>
  );
}
