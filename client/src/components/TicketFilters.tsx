import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketStatus, TicketCategory } from "@helpdesk/core";

const STATUS_LABELS: Record<string, string> = {
  "": "All statuses",
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

interface Props {
  search: string;
  status: TicketStatus | "";
  category: TicketCategory | "";
  onSearchChange: (v: string) => void;
  onStatusChange: (v: TicketStatus | "") => void;
  onCategoryChange: (v: TicketCategory | "") => void;
}

export default function TicketFilters({
  search,
  status,
  category,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[16rem] max-w-md">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
        />
        <Input
          aria-label="Search tickets"
          placeholder="Search by name, email, or subject…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-9 text-[13px]"
        />
      </div>

      <Select value={status} onValueChange={(v) => onStatusChange(v as TicketStatus | "")}>
        <SelectTrigger aria-label="Status" size="sm" className="h-9 w-36">
          <SelectValue>{(v: string | null) => STATUS_LABELS[v ?? ""]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All statuses</SelectItem>
          <SelectItem value={TicketStatus.open}>Open</SelectItem>
          <SelectItem value={TicketStatus.resolved}>Resolved</SelectItem>
          <SelectItem value={TicketStatus.closed}>Closed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={(v) => onCategoryChange(v as TicketCategory | "")}>
        <SelectTrigger aria-label="Category" size="sm" className="h-9 w-40">
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
    </div>
  );
}
