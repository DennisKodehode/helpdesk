import {
  type InviteAgentData,
  type Role,
  type RosterAgent,
  rosterResponseSchema,
  type UserStatus,
} from "@helpdesk/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export const ROSTER_QUERY_KEY = ["roster"] as const;

export function useRoster() {
  return useQuery<RosterAgent[]>({
    queryKey: ROSTER_QUERY_KEY,
    queryFn: ({ signal }) =>
      axios
        .get("/api/users/roster", { signal })
        .then((r) => rosterResponseSchema.parse(r.data)),
  });
}

function useInvalidateRoster() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ROSTER_QUERY_KEY });
}

export function useInviteAgent() {
  const invalidate = useInvalidateRoster();
  return useMutation({
    mutationFn: (data: InviteAgentData) =>
      axios.post<RosterAgent>("/api/users", data).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: (id: string) => axios.post(`/api/users/${id}/invite/resend`),
  });
}

export function useUpdateAgentRole() {
  const invalidate = useInvalidateRoster();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      axios.patch(`/api/users/${id}/role`, { role }),
    onSuccess: invalidate,
  });
}

export function useUpdateAgentStatus() {
  const invalidate = useInvalidateRoster();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      axios.patch(`/api/users/${id}/status`, { status }),
    onSuccess: invalidate,
  });
}

export function useRemoveAgent() {
  const invalidate = useInvalidateRoster();
  return useMutation({
    mutationFn: (id: string) => axios.delete(`/api/users/${id}`),
    onSuccess: invalidate,
  });
}
