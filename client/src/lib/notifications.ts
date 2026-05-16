import { type NotificationsResponse, NotificationType } from "@helpdesk/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const QUERY_KEY = ["notifications"] as const;

const POLL_INTERVAL_MS = 30_000;

async function fetchNotifications(): Promise<NotificationsResponse> {
  const { data } = await axios.get<NotificationsResponse>("/api/notifications");
  return data;
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchNotifications,
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => axios.patch(`/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axios.post("/api/notifications/mark-all-read"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export const NOTIFICATION_TYPE_LABEL: Record<
  NotificationType,
  (actorName: string | null) => string
> = {
  [NotificationType.customer_reply]: () => "Customer replied",
  [NotificationType.ticket_assigned]: (actor) =>
    actor ? `${actor} assigned you a ticket` : "You were assigned a ticket",
};
