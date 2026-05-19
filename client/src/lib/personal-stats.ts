import type { PersonalStatsResponse } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const PERSONAL_STATS_QUERY_KEY = ["personal-stats"] as const;

async function fetchPersonalStats(signal?: AbortSignal): Promise<PersonalStatsResponse> {
  const { data } = await axios.get<PersonalStatsResponse>("/api/stats/me", { signal });
  return data;
}

export function usePersonalStats(enabled: boolean) {
  return useQuery({
    queryKey: PERSONAL_STATS_QUERY_KEY,
    queryFn: ({ signal }) => fetchPersonalStats(signal),
    enabled,
    refetchOnWindowFocus: true,
  });
}
