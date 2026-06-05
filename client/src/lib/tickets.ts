import type {
  PaginatedTickets,
  TicketDetail,
  TicketPriority,
  TicketSortField,
  TicketView,
} from "@helpdesk/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { CategoryFilterValue, StatusFilterValue } from "@/components/TicketFilters";

/** SLA-state filter sentinel ("" = no filter). Shared by every tickets view. */
export type SlaStateFilterValue = "at_risk" | "ok" | "";

export interface TicketsQueryParams {
  sortBy: TicketSortField;
  sortOrder: "asc" | "desc";
  status: StatusFilterValue;
  category: CategoryFilterValue;
  priority: TicketPriority | "";
  assignee: string;
  search: string;
  breachedOnly: boolean;
  slaState: SlaStateFilterValue;
  view: TicketView | null;
  // Archive scope — closed tickets only. Mutually exclusive with `view`/`status`
  // (those are Active-scope concepts); category/priority/search still compose.
  archived: boolean;
  page: number;
  pageSize: number;
}

async function fetchTickets(
  p: TicketsQueryParams,
  signal?: AbortSignal,
): Promise<PaginatedTickets> {
  // Archive is its own base scope (closed-only); it ignores view/status and the
  // Active-only SLA filters. Active scope is unchanged: a `view` preset OR the
  // per-field status/SLA filters.
  const scope = p.archived
    ? { archived: "true" as const }
    : p.view
      ? { view: p.view }
      : {
          ...(p.status && { status: p.status }),
          ...(p.breachedOnly && { breachedOnly: "true" }),
          ...(p.slaState && { slaState: p.slaState }),
        };

  const { data } = await axios.get<PaginatedTickets>("/api/tickets", {
    params: {
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      ...scope,
      // category/priority/assignee compose in Active (non-view) and Archive
      // scopes; the server ignores them only when a `view` preset is active.
      ...(!p.view && p.category && { category: p.category }),
      ...(!p.view && p.priority && { priority: p.priority }),
      ...(!p.view && p.assignee && { assignee: p.assignee }),
      ...(p.search.trim() && { search: p.search.trim() }),
      page: p.page,
      pageSize: p.pageSize,
    },
    signal,
  });
  return data;
}

/**
 * The list/queue query, shared by the desktop table, the tablet master-detail
 * list pane, and the mobile ticket list. The query key matches the historical
 * positional shape from `TicketsPage` exactly, so cache continuity holds.
 */
export function useTickets(params: TicketsQueryParams) {
  return useQuery({
    queryKey: [
      "tickets",
      params.sortBy,
      params.sortOrder,
      params.status,
      params.category,
      params.priority,
      params.assignee,
      params.search,
      params.breachedOnly,
      params.slaState,
      params.view,
      params.archived,
      params.page,
    ],
    queryFn: ({ signal }) => fetchTickets(params, signal),
    placeholderData: keepPreviousData,
  });
}

async function fetchTicket(id: string, signal?: AbortSignal): Promise<TicketDetail> {
  const { data } = await axios.get<TicketDetail>(`/api/tickets/${id}`, { signal });
  return data;
}

/**
 * Single-ticket detail query, shared by the desktop detail page, the tablet
 * detail pane, and the mobile ticket detail. Key matches the historical
 * `["ticket", id]` shape.
 */
export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: ["ticket", id],
    queryFn: ({ signal }) => fetchTicket(id!, signal),
    enabled: !!id,
  });
}
