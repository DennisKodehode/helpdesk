import type { KbSuggestion } from "@helpdesk/core";
import axios from "axios";
import { useEffect, useState } from "react";
import AgentToast from "@/components/AgentToast";
import KbSuggestionApproveDialog from "@/components/KbSuggestionApproveDialog";
import KbSuggestionRejectDialog from "@/components/KbSuggestionRejectDialog";
import KbSuggestionTable from "@/components/KbSuggestionTable";
import { useKbSuggestions, useRejectKbSuggestion } from "@/lib/kb";

function errorMessage(err: unknown): string {
  return axios.isAxiosError(err)
    ? (err.response?.data?.error ?? "Something went wrong")
    : "Something went wrong";
}

export default function KbSuggestionsView() {
  const { data: suggestions = [], isPending, isError } = useKbSuggestions("pending");
  const reject = useRejectKbSuggestion();

  const [approveTarget, setApproveTarget] = useState<KbSuggestion | null>(null);
  const [rejectTarget, setRejectTarget] = useState<KbSuggestion | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  function confirmReject(reason: string) {
    if (!rejectTarget) return;
    reject.mutate(
      { id: rejectTarget.id, data: { reason: reason || undefined } },
      {
        onSuccess: () => {
          setFlash("Suggestion rejected.");
          setRejectTarget(null);
        },
        onError: (err) => {
          setFlash(errorMessage(err));
          setRejectTarget(null);
        },
      },
    );
  }

  return (
    <>
      <KbSuggestionTable
        suggestions={suggestions}
        isPending={isPending}
        isError={isError}
        onApprove={setApproveTarget}
        onReject={setRejectTarget}
      />

      <KbSuggestionApproveDialog
        suggestion={approveTarget}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
        onApproved={setFlash}
      />
      <KbSuggestionRejectDialog
        suggestion={rejectTarget}
        isRejecting={reject.isPending}
        onConfirm={confirmReject}
        onCancel={() => setRejectTarget(null)}
      />
      <AgentToast message={flash} />
    </>
  );
}
