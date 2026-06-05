import { type InviteAgentData, inviteAgentSchema, Role } from "@helpdesk/core";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import axios from "axios";
import { Send, ShieldCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
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
import { useInviteAgent } from "@/lib/agents";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Only the global admin may invite admins; for everyone else the role selector
  // collapses to Agent-only (the server rejects an admin invite regardless).
  canInviteAdmins: boolean;
  onInvited: (email: string) => void;
}

const DEFAULTS: InviteAgentData = { name: "", email: "", role: Role.agent };

export default function InviteAgentDialog({
  open,
  onOpenChange,
  canInviteAdmins,
  onInvited,
}: Props) {
  const invite = useInviteAgent();
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<InviteAgentData>({
    resolver: standardSchemaResolver(inviteAgentSchema),
    defaultValues: DEFAULTS,
  });
  const role = watch("role");

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset(DEFAULTS);
  }

  function onSubmit(data: InviteAgentData) {
    invite.mutate(data, {
      onSuccess: () => {
        onInvited(data.email);
        reset(DEFAULTS);
        onOpenChange(false);
      },
      onError: (err) => {
        if (axios.isAxiosError(err)) {
          setError("email", {
            message: err.response?.data?.error ?? "Something went wrong",
          });
        }
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <p className="eyebrow mb-2">Administration</p>
          <DialogTitle className="display-serif text-[28px] leading-tight">
            Invite an agent
          </DialogTitle>
          <p className="mt-2 text-[14px] text-ink-3">
            They'll receive an email invitation to set their password and join.
          </p>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-4 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-name">Full name</Label>
            <Input
              id="invite-name"
              placeholder="Jordan Ellis"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">Work email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="jordan@example.com"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>
          {canInviteAdmins && (
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  // Segmented look, real radio semantics (visually-hidden inputs).
                  <fieldset className="inline-flex gap-1 self-start rounded-[var(--r-sm)] border border-border bg-panel-2 p-1">
                    <legend className="sr-only">Role</legend>
                    {[
                      { value: Role.agent, label: "Agent", icon: false },
                      { value: Role.admin, label: "Admin", icon: true },
                    ].map(({ value, label, icon }) => (
                      <label
                        key={value}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] transition-colors ${
                          field.value === value
                            ? "bg-card font-semibold text-foreground shadow-[var(--shadow-sm)]"
                            : "text-ink-3 hover:text-foreground"
                        }`}
                      >
                        <input
                          type="radio"
                          name="invite-role"
                          className="sr-only"
                          checked={field.value === value}
                          onChange={() => field.onChange(value)}
                        />
                        {icon && <ShieldCheck className="size-3.5" aria-hidden />}
                        {label}
                      </label>
                    ))}
                  </fieldset>
                )}
              />
              <p className="text-[12.5px] text-ink-4">
                {role === Role.admin
                  ? "Can manage agents and SLA targets, and force any status transition."
                  : "Can triage, reply to, and resolve tickets."}
              </p>
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={invite.isPending}>
              <Send className="size-4" aria-hidden />
              {invite.isPending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
