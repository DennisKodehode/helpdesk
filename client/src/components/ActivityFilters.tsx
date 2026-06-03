import {
  ACTOR_AI_FILTER_VALUE,
  ACTOR_SYSTEM_FILTER_VALUE,
  AuditEventType,
  type RosterAgent,
} from "@helpdesk/core";
import DatePicker from "@/components/ui/DatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_TYPE_LABELS } from "@/lib/audit-display";

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
}

const TYPE_LABELS: Record<string, string> = {
  "": "All events",
  ...EVENT_TYPE_LABELS,
};

export default function ActivityFilters({
  type,
  actorId,
  from,
  to,
  actors,
  onTypeChange,
  onActorChange,
  onFromChange,
  onToChange,
}: Props) {
  // Actor label map: the two non-human sentinels plus every roster member by id.
  const actorLabels: Record<string, string> = {
    "": "All actors",
    [ACTOR_AI_FILTER_VALUE]: "AI",
    [ACTOR_SYSTEM_FILTER_VALUE]: "System / automated",
    ...Object.fromEntries(actors.map((a) => [a.id, a.name])),
  };

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
          <SelectItem value={ACTOR_AI_FILTER_VALUE}>AI</SelectItem>
          <SelectItem value={ACTOR_SYSTEM_FILTER_VALUE}>System / automated</SelectItem>
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
          className="h-10 w-full sm:h-9 sm:w-48"
        >
          <SelectValue>{(v: string | null) => TYPE_LABELS[v ?? ""]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All events</SelectItem>
          {Object.values(AuditEventType).map((t) => (
            <SelectItem key={t} value={t}>
              {EVENT_TYPE_LABELS[t]}
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
    </div>
  );
}
