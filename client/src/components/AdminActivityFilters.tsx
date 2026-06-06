import {
  ACTOR_SYSTEM_FILTER_VALUE,
  AdminAuditEventType,
  type RosterAgent,
} from "@helpdesk/core";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/DatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADMIN_EVENT_TYPE_LABELS } from "@/lib/admin-audit-display";

interface Props {
  type: string;
  actorId: string;
  from: string;
  to: string;
  actors: RosterAgent[];
  onTypeChange: (v: string) => void;
  onActorChange: (v: string) => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onClearAll: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  "": "All events",
  ...ADMIN_EVENT_TYPE_LABELS,
};

export default function AdminActivityFilters({
  type,
  actorId,
  from,
  to,
  actors,
  onTypeChange,
  onActorChange,
  onFromChange,
  onToChange,
  onClearAll,
}: Props) {
  // Admin actions are always by a human; the only non-id actor option is the
  // System sentinel (an actor that was since deleted → actorId null).
  const actorLabels: Record<string, string> = {
    "": "All actors",
    [ACTOR_SYSTEM_FILTER_VALUE]: "System / removed",
    ...Object.fromEntries(actors.map((a) => [a.id, a.name])),
  };
  const hasFilters = Boolean(type || actorId || from || to);

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Select<string> value={actorId} onValueChange={(v) => onActorChange(v ?? "")}>
        <SelectTrigger
          aria-label="Actor"
          size="sm"
          className="h-10 w-full sm:h-9 sm:w-52"
        >
          <SelectValue>
            {(v: string | null) => actorLabels[v ?? ""] ?? "Unknown"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All actors</SelectItem>
          <SelectItem value={ACTOR_SYSTEM_FILTER_VALUE}>System / removed</SelectItem>
          {actors.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select<string> value={type} onValueChange={(v) => onTypeChange(v ?? "")}>
        <SelectTrigger
          aria-label="Event type"
          size="sm"
          className="h-10 w-full sm:h-9 sm:w-52"
        >
          <SelectValue>{(v: string | null) => TYPE_LABELS[v ?? ""]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All events</SelectItem>
          {Object.values(AdminAuditEventType).map((t) => (
            <SelectItem key={t} value={t}>
              {ADMIN_EVENT_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DatePicker
        ariaLabel="From date"
        value={from}
        max={to || undefined}
        onChange={onFromChange}
        className="w-full sm:w-40"
      />
      <DatePicker
        ariaLabel="To date"
        value={to}
        min={from || undefined}
        onChange={onToChange}
        className="w-full sm:w-40"
      />

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-ink-3 hover:text-foreground"
        >
          <X className="size-4" aria-hidden /> Clear filters
        </Button>
      )}
    </div>
  );
}
