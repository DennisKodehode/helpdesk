import {
  type ApproveKbSuggestionData,
  type CreateKbArticleData,
  type KbArticle,
  type KbSuggestion,
  kbArticlesResponseSchema,
  kbSuggestionsCountResponseSchema,
  kbSuggestionsResponseSchema,
  type RejectKbSuggestionData,
  type UpdateKbArticleData,
} from "@helpdesk/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export const KB_QUERY_KEY = ["kb-articles"] as const;
export const KB_SUGGESTIONS_QUERY_KEY = ["kb-suggestions"] as const;
export const KB_SUGGESTIONS_COUNT_QUERY_KEY = ["kb-suggestions", "count"] as const;

export function useKbArticles() {
  return useQuery<KbArticle[]>({
    queryKey: KB_QUERY_KEY,
    queryFn: ({ signal }) =>
      axios
        .get("/api/kb-articles", { signal })
        .then((r) => kbArticlesResponseSchema.parse(r.data)),
  });
}

function useInvalidateKb() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KB_QUERY_KEY });
}

export function useCreateKbArticle() {
  const invalidate = useInvalidateKb();
  return useMutation({
    mutationFn: (data: CreateKbArticleData) =>
      axios.post<KbArticle>("/api/kb-articles", data).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useUpdateKbArticle() {
  const invalidate = useInvalidateKb();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateKbArticleData }) =>
      axios.patch<KbArticle>(`/api/kb-articles/${id}`, data).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeleteKbArticle() {
  const invalidate = useInvalidateKb();
  return useMutation({
    mutationFn: (id: string) => axios.delete(`/api/kb-articles/${id}`),
    onSuccess: invalidate,
  });
}

// --- KB suggestions (approval queue) ---------------------------------------

export function useKbSuggestions(status = "pending") {
  return useQuery<KbSuggestion[]>({
    queryKey: [...KB_SUGGESTIONS_QUERY_KEY, status],
    queryFn: ({ signal }) =>
      axios
        .get("/api/kb-suggestions", { params: { status }, signal })
        .then((r) => kbSuggestionsResponseSchema.parse(r.data)),
  });
}

// Lightweight pending count for the sidebar badge (admins only).
export function useKbSuggestionsCount(enabled: boolean) {
  return useQuery({
    queryKey: KB_SUGGESTIONS_COUNT_QUERY_KEY,
    queryFn: ({ signal }) =>
      axios
        .get("/api/kb-suggestions/count", { signal })
        .then((r) => kbSuggestionsCountResponseSchema.parse(r.data)),
    enabled,
  });
}

// Approving creates a KbArticle, so both the suggestion list/count AND the
// article list go stale.
function useInvalidateSuggestions() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: KB_SUGGESTIONS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: KB_QUERY_KEY });
  };
}

export function useApproveKbSuggestion() {
  const invalidate = useInvalidateSuggestions();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveKbSuggestionData }) =>
      axios.post(`/api/kb-suggestions/${id}/approve`, data),
    onSuccess: invalidate,
  });
}

export function useRejectKbSuggestion() {
  const invalidate = useInvalidateSuggestions();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectKbSuggestionData }) =>
      axios.post(`/api/kb-suggestions/${id}/reject`, data),
    onSuccess: invalidate,
  });
}

export function useSuggestTicketForKb() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: number) =>
      axios.post(`/api/tickets/${ticketId}/suggest-kb`).then((r) => r.data),
    // Refresh the ticket detail so its `hasKbSuggestion` flips true — the button
    // then reflects "already suggested" even after navigating away and back.
    onSuccess: (_data, ticketId) =>
      queryClient.invalidateQueries({ queryKey: ["ticket", String(ticketId)] }),
  });
}
