import {
  type PaginatedAdminAuditEvents,
  paginatedAdminAuditEventsSchema,
} from "@helpdesk/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface AdminAuditFilters {
  type: string;
  actorId: string;
  from: string;
  to: string;
  page: number;
}

// Admin-action audit-log query — mirrors useAuditEvents but hits the admin-only
// /api/admin-audit-events endpoint. Empty filter strings are omitted so the
// server treats them as "no filter". keepPreviousData keeps the table populated
// while paging/filtering.
export function useAdminAuditEvents(
  { type, actorId, from, to, page }: AdminAuditFilters,
  enabled = true,
) {
  return useQuery<PaginatedAdminAuditEvents>({
    queryKey: ["admin-audit-events", type, actorId, from, to, page],
    queryFn: ({ signal }) =>
      axios
        .get("/api/admin-audit-events", {
          params: {
            ...(type && { type }),
            ...(actorId && { actorId }),
            ...(from && { from }),
            ...(to && { to }),
            page,
          },
          signal,
        })
        .then((r) => paginatedAdminAuditEventsSchema.parse(r.data)),
    placeholderData: keepPreviousData,
    enabled,
  });
}
