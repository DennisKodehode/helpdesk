import {
  type Notification,
  type NotificationsResponse,
  NotificationType,
  type SlaMetric,
} from "@helpdesk/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { formatRelative, SLA_METRIC_LABELS } from "./ticket-ui";

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

function formatSlaBreach(n: Notification): string {
  const data = n.data as { metric?: SlaMetric; breachedAt?: string } | null | undefined;
  const metric =
    data?.metric && data.metric in SLA_METRIC_LABELS
      ? SLA_METRIC_LABELS[data.metric]
      : "SLA";
  const when = data?.breachedAt ? ` ${formatRelative(data.breachedAt)}` : "";
  return `${metric} breached${when}`;
}

export const NOTIFICATION_TYPE_LABEL: Record<
  NotificationType,
  (n: Notification) => string
> = {
  [NotificationType.customer_reply]: () => "Customer replied",
  [NotificationType.ticket_assigned]: (n) =>
    n.actorName ? `${n.actorName} assigned you a ticket` : "You were assigned a ticket",
  [NotificationType.sla_breach_warning]: formatSlaBreach,
};
