import { useQuery } from "@tanstack/react-query";

import { PendingFamilySubmissionCard } from "@/components/admin/PendingFamilySubmissionCard";
import type { AdminActions, AdminData } from "../types";
import { fetchPendingSubmissions } from "@/lib/family";

type Props = {
  data: AdminData;
  actions: AdminActions;
};

export function PendingPage({ data, actions }: Props) {
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["admin", "pending-submissions"],
    queryFn: fetchPendingSubmissions,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading submissions…</p>;
  }

  if (submissions.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No pending family submissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {submissions.length} family submission{submissions.length === 1 ? "" : "s"} awaiting review. Edit any field,
        save, then approve the whole family at once.
      </p>
      {submissions.map((sub) => (
        <PendingFamilySubmissionCard
          key={sub.id}
          submission={sub}
          allMembers={data.all}
          otherSubmissions={submissions}
          onSave={actions.saveSubmission}
          onApprove={actions.approveSubmission}
          onReject={actions.rejectSubmission}
        />
      ))}
    </div>
  );
}
