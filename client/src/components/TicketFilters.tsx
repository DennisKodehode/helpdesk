import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TRIAGING_FILTER_VALUE,
  type TriagingFilterValue,
  UNCATEGORIZED_FILTER_VALUE,
  type UncategorizedFilterValue,
} from "@helpdesk/core";
import { AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";

export type StatusFilterValue = TicketStatus | TriagingFilterValue | "";
export type CategoryFilterValue = TicketCategory | UncategorizedFilterValue | "";

const STATUS_LABELS: Record<string, string> = {
  "": "All statuses",
  [TRIAGING_FILTER_VALUE]: "Triaging",
  [TicketStatus.open]: "Open",
  [TicketStatus.resolved]: "Resolved",
  // No "Closed" — closed tickets live in the Archive scope (ScopeToggle).
};

const CATEGORY_LABELS: Record<string, string> = {
  "": "All categories",
  [UNCATEGORIZED_FILTER_VALUE]: "Uncategorized",
  [TicketCategory.technical_question]: "Technical",
  [TicketCategory.billing_inquiry]: "Billing",
  [TicketCategory.refund_request]: "Refund",
  [TicketCategory.feature_request]: "Feature",
  [TicketCategory.general_question]: "General",
};

const PRIORITY_FILTER_LABELS: Record<string, string> = {
  "": "All priorities",
  [TicketPriority.urgent]: "Urgent",
  [TicketPriority.high]: "High",
  [TicketPriority.normal]: "Normal",
  [TicketPriority.low]: "Low",
};

interface Props {
  search: string;
  status: StatusFilterValue;
  category: CategoryFilterValue;
  priority: TicketPriority | "";
  breachedOnly: boolean;
  // Archive scope (closed tickets): hide the status + breached-SLA controls,
  // which are Active-scope concepts. Search/category/priority still apply.
  archived?: boolean;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: StatusFilterValue) => void;
  onCategoryChange: (v: CategoryFilterValue) => void;
  onPriorityChange: (v: TicketPriority | "") => void;
  onBreachedOnlyChange: (v: boolean) => void;
}

export default function TicketFilters({
  search,
  status,
  category,
  priority,
  breachedOnly,
  archived,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
  onPriorityChange,
  onBreachedOnlyChange,
}: Props) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:flex-1 sm:min-w-[16rem] sm:max-w-md xl:max-w-xl 2xl:max-w-2xl">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
        />
        <Input
          aria-label="Search tickets"
          placeholder="Search by name, email, or subject…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 pl-9 text-[13px] sm:h-9"
        />
      </div>

      {!archived && (
        <Select<StatusFilterValue>
          value={status}
          onValueChange={(v) => onStatusChange(v as StatusFilterValue)}
        >
          <SelectTrigger
            aria-label="Status"
            size="sm"
            className="h-10 w-full sm:h-9 sm:w-36"
          >
            <SelectValue>{(v: string | null) => STATUS_LABELS[v ?? ""]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value={TRIAGING_FILTER_VALUE}>Triaging</SelectItem>
            <SelectItem value={TicketStatus.open}>Open</SelectItem>
            <SelectItem value={TicketStatus.resolved}>Resolved</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Select<CategoryFilterValue>
        value={category}
        onValueChange={(v) => onCategoryChange(v as CategoryFilterValue)}
      >
        <SelectTrigger
          aria-label="Category"
          size="sm"
          className="h-10 w-full sm:h-9 sm:w-40"
        >
          <SelectValue>{(v: string | null) => CATEGORY_LABELS[v ?? ""]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All categories</SelectItem>
          <SelectItem value={UNCATEGORIZED_FILTER_VALUE}>Uncategorized</SelectItem>
          <SelectItem value={TicketCategory.technical_question}>Technical</SelectItem>
          <SelectItem value={TicketCategory.billing_inquiry}>Billing</SelectItem>
          <SelectItem value={TicketCategory.refund_request}>Refund</SelectItem>
          <SelectItem value={TicketCategory.feature_request}>Feature</SelectItem>
          <SelectItem value={TicketCategory.general_question}>General</SelectItem>
        </SelectContent>
      </Select>

      <Select<TicketPriority | "">
        value={priority}
        onValueChange={(v) => onPriorityChange(v as TicketPriority | "")}
      >
        <SelectTrigger
          aria-label="Priority"
          size="sm"
          className="h-10 w-full sm:h-9 sm:w-36"
        >
          <SelectValue>
            {(v: string | null) => PRIORITY_FILTER_LABELS[v ?? ""]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All priorities</SelectItem>
          <SelectItem value={TicketPriority.urgent}>Urgent</SelectItem>
          <SelectItem value={TicketPriority.high}>High</SelectItem>
          <SelectItem value={TicketPriority.normal}>Normal</SelectItem>
          <SelectItem value={TicketPriority.low}>Low</SelectItem>
        </SelectContent>
      </Select>

      {!archived && (
        <Toggle
          aria-label="Show only tickets that have breached their SLA"
          variant="outline"
          size="default"
          pressed={breachedOnly}
          onPressedChange={onBreachedOnlyChange}
          className="h-10 aria-pressed:border-ros-dot/40 aria-pressed:bg-ros-bg aria-pressed:text-ros-fg aria-pressed:hover:bg-ros-bg aria-pressed:hover:text-ros-fg data-[state=on]:border-ros-dot/40 data-[state=on]:bg-ros-bg data-[state=on]:text-ros-fg sm:h-9"
        >
          <AlertTriangle className="size-3.5" aria-hidden />
          Breached only
        </Toggle>
      )}
    </div>
  );
}
