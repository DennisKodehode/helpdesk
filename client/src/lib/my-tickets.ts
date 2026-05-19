import type { MyOpenCount } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const MY_OPEN_COUNT_QUERY_KEY = ["my-open-count"] as const;

const POLL_INTERVAL_MS = 30_000;

async function fetchMyOpenCount(signal?: AbortSignal): Promise<MyOpenCount> {
  const { data } = await axios.get<MyOpenCount>("/api/tickets/my-open-count", {
    signal,
  });
  return data;
}

export function useMyOpenCount(enabled: boolean) {
  return useQuery({
    queryKey: MY_OPEN_COUNT_QUERY_KEY,
    queryFn: ({ signal }) => fetchMyOpenCount(signal),
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    refetchOnWindowFocus: true,
  });
}
