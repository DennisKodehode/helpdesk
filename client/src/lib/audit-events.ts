import { type PaginatedAuditEvents, paginatedAuditEventsSchema } from "@helpdesk/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface AuditEventFilters {
  type: string;
  actorId: string;
  from: string;
  to: string;
  page: number;
}

// Admin activity-log query. Empty filter strings are omitted from the request
// so the server treats them as "no filter". keepPreviousData keeps the table
// populated while paging/filtering, mirroring the tickets queue.
export function useAuditEvents({ type, actorId, from, to, page }: AuditEventFilters) {
  return useQuery<PaginatedAuditEvents>({
    queryKey: ["audit-events", type, actorId, from, to, page],
    queryFn: ({ signal }) =>
      axios
        .get("/api/audit-events", {
          params: {
            ...(type && { type }),
            ...(actorId && { actorId }),
            ...(from && { from }),
            ...(to && { to }),
            page,
          },
          signal,
        })
        .then((r) => paginatedAuditEventsSchema.parse(r.data)),
    placeholderData: keepPreviousData,
  });
}
