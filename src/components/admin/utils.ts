import type { Member, PendingFamilySubmission } from "@/lib/family";
import {
  findSubmissionDuplicates,
  namesFromSubmissionForm,
  type DuplicateNameHit,
} from "@/lib/submission-validate";

export type { DuplicateNameHit };
export { findSubmissionDuplicates, namesFromSubmissionForm };
export function submissionMemberIds(sub: PendingFamilySubmission): number[] {
  const ids = sub.member_ids;
  return [ids.fatherId, ...ids.motherIds, ...ids.childIds].filter((id): id is number => id != null);
}

export function submissionDuplicateWarnings(
  submission: PendingFamilySubmission,
  allMembers: Member[],
  allSubmissions: PendingFamilySubmission[],
) {
  return findSubmissionDuplicates(submission.form, allMembers, {
    excludeMemberIds: submissionMemberIds(submission),
    excludeSubmissionId: submission.id,
    otherSubmissions: allSubmissions,
  });
}

export function countSubmissionsWithDuplicates(
  submissions: PendingFamilySubmission[],
  allMembers: Member[],
) {
  return submissions.filter((sub) => submissionDuplicateWarnings(sub, allMembers, submissions).length > 0).length;
}

export function downloadFile(name: string, data: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function duplicateGroupKey(group: Member[]): string {
  return [...group]
    .sort((a, b) => a.id - b.id)
    .map((m) => m.id)
    .join(",");
}

export function findDuplicates(all: Member[], dismissedKeys?: Set<string>) {
  const map = new Map<string, Member[]>();
  all.forEach((m) => {
    const k = m.full_name.trim().toLowerCase();
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(m);
  });
  return [...map.values()]
    .filter((v) => v.length > 1)
    .filter((group) => !dismissedKeys?.has(duplicateGroupKey(group)));
}

export function buildExports(all: Member[]) {
  const exportCSV = () => {
    const cols = [
      "id",
      "full_name",
      "gender",
      "father_id",
      "mother_id",
      "generation_level",
      "is_in_kin",
      "is_alive",
      "current_location",
      "submitted_by",
      "submitter_phone",
      "is_approved",
    ] as const;
    const rows = [cols.join(",")];
    all.forEach((m) =>
      rows.push(cols.map((c) => JSON.stringify((m as unknown as Record<string, unknown>)[c] ?? "")).join(",")),
    );
    downloadFile("family.csv", rows.join("\n"), "text/csv");
  };

  const exportJSON = () => downloadFile("family.json", JSON.stringify(all, null, 2), "application/json");

  const exportGEDCOM = () => {
    const lines: string[] = ["0 HEAD", "1 SOUR Qadi Yonis", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
    all.forEach((m) => {
      lines.push(`0 @I${m.id}@ INDI`);
      lines.push(`1 NAME ${m.full_name}`);
      lines.push(`1 SEX ${m.gender === "male" ? "M" : "F"}`);
      if (!m.is_alive) lines.push("1 DEAT Y");
    });
    lines.push("0 TRLR");
    downloadFile("family.ged", lines.join("\n"), "text/plain");
  };

  return { exportCSV, exportJSON, exportGEDCOM };
}
