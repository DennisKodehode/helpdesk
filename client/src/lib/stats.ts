import type { SlaComplianceResponse, StatsResponse } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// Dashboard-wide ticket counts. Shared by the dashboard stat cards and the
// Workflow pipeline diagram so both read the same source (queryKey ["stats"]).
export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: ["stats"],
    queryFn: ({ signal }) =>
      axios.get<StatsResponse>("/api/stats", { signal }).then((r) => r.data),
  });
}

// 30-day SLA-compliance percents (first response / resolution). Shared by the
// dashboard rings card and the Workflow compliance-threshold preview so both
// read one cache entry (queryKey ["stats", "sla-compliance"]).
export function useSlaCompliance() {
  return useQuery<SlaComplianceResponse>({
    queryKey: ["stats", "sla-compliance"],
    queryFn: ({ signal }) =>
      axios
        .get<SlaComplianceResponse>("/api/stats/sla-compliance", { signal })
        .then((r) => r.data),
  });
}
