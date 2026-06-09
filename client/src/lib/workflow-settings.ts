import {
  type UpdateWorkflowSettingsData,
  type WorkflowSettings,
  workflowSettingsSchema,
} from "@helpdesk/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

// The editable lifecycle fields (everything the Workflow screen mutates) —
// the server's `updatedAt` is read-only, so it's excluded from the working draft.
export type LifecycleDraft = Omit<WorkflowSettings, "updatedAt">;

const QUERY_KEY = ["workflow-settings"] as const;

// Settings change rarely (an admin edits them on the Workflow screen). Cache for
// 5 minutes so the ticket-detail consumers (composer lock, resolve gating)
// don't refetch on every navigation.
const STALE_TIME_MS = 5 * 60_000;

async function fetchWorkflowSettings(signal?: AbortSignal): Promise<WorkflowSettings> {
  const { data } = await axios.get("/api/workflow-settings", { signal });
  return workflowSettingsSchema.parse(data);
}

export function useWorkflowSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => fetchWorkflowSettings(signal),
    staleTime: STALE_TIME_MS,
  });
}

export function useUpdateWorkflowSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    // Returns how many existing unassigned tickets the save auto-assigned (0
    // unless auto-assign is on and the queue had unassigned tickets) so the page
    // can confirm the side effect.
    mutationFn: async (data: UpdateWorkflowSettingsData): Promise<number> => {
      const { data: res } = await axios.patch("/api/workflow-settings", data);
      return typeof res?.assignedCount === "number" ? res.assignedCount : 0;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
