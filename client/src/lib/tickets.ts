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
  page: number;
  pageSize: number;
}

async function fetchTickets(
  p: TicketsQueryParams,
  signal?: AbortSignal,
): Promise<PaginatedTickets> {
  const { data } = await axios.get<PaginatedTickets>("/api/tickets", {
    params: {
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      // When `view` is set the server applies its preset and ignores the
      // per-field filters, so we don't bother sending them.
      ...(p.view ? { view: p.view } : null),
      ...(!p.view && p.status && { status: p.status }),
      ...(!p.view && p.category && { category: p.category }),
      ...(!p.view && p.priority && { priority: p.priority }),
      ...(!p.view && p.assignee && { assignee: p.assignee }),
      ...(!p.view && p.breachedOnly && { breachedOnly: "true" }),
      ...(!p.view && p.slaState && { slaState: p.slaState }),
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
