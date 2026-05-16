import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TRIAGING_FILTER_VALUE,
  type TriagingFilterValue,
} from "@helpdesk/core";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StatusFilterValue = TicketStatus | TriagingFilterValue | "";

const STATUS_LABELS: Record<string, string> = {
  "": "All statuses",
  [TRIAGING_FILTER_VALUE]: "Triaging",
  [TicketStatus.open]: "Open",
  [TicketStatus.resolved]: "Resolved",
  [TicketStatus.closed]: "Closed",
};

const CATEGORY_LABELS: Record<string, string> = {
  "": "All categories",
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
  category: TicketCategory | "";
  priority: TicketPriority | "";
  onSearchChange: (v: string) => void;
  onStatusChange: (v: StatusFilterValue) => void;
  onCategoryChange: (v: TicketCategory | "") => void;
  onPriorityChange: (v: TicketPriority | "") => void;
}

export default function TicketFilters({
  search,
  status,
  category,
  priority,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
  onPriorityChange,
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
          <SelectItem value={TicketStatus.closed}>Closed</SelectItem>
        </SelectContent>
      </Select>

      <Select<TicketCategory | "">
        value={category}
        onValueChange={(v) => onCategoryChange(v as TicketCategory | "")}
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
    </div>
  );
}
