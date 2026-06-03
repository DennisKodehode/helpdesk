import type { StatsResponse } from "@helpdesk/core";
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
