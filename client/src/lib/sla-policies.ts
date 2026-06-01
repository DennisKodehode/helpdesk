import {
  type SlaHealthResponse,
  type SlaPolicy,
  slaHealthResponseSchema,
  slaPoliciesResponseSchema,
  type TicketPriority,
  type UpdateSlaPolicyData,
} from "@helpdesk/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const QUERY_KEY = ["sla-policies"] as const;
const HEALTH_QUERY_KEY = ["stats", "sla-health"] as const;

// Policies change rarely (admins tweak the four rows by hand). Cache for
// 5 minutes so the badge in every ticket row doesn't trigger refetches.
const STALE_TIME_MS = 5 * 60_000;

async function fetchSlaPolicies(signal?: AbortSignal): Promise<SlaPolicy[]> {
  const { data } = await axios.get("/api/sla-policies", { signal });
  return slaPoliciesResponseSchema.parse(data);
}

export type SlaPolicyMap = Partial<Record<TicketPriority, SlaPolicy>>;

function toMap(policies: SlaPolicy[]): SlaPolicyMap {
  const map: SlaPolicyMap = {};
  for (const p of policies) map[p.priority] = p;
  return map;
}

export function useSlaPolicies() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => fetchSlaPolicies(signal),
    staleTime: STALE_TIME_MS,
    select: toMap,
  });
}

// The editor screen needs the ordered array (not the badge-lookup map).
export function useSlaPoliciesList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => fetchSlaPolicies(signal),
    staleTime: STALE_TIME_MS,
  });
}

export function useSlaHealth() {
  return useQuery<SlaHealthResponse>({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: ({ signal }) =>
      axios
        .get("/api/stats/sla-health", { signal })
        .then((r) => slaHealthResponseSchema.parse(r.data)),
  });
}

export function useUpdateSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      priority,
      data,
    }: {
      priority: TicketPriority;
      data: UpdateSlaPolicyData;
    }) => axios.patch(`/api/sla-policies/${priority}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
