import type { Member, PendingFamilySubmission, SubmitFamilyPayload } from "@/lib/family";

export type DuplicateNameHit = {
  name: string;
  role: "father" | "mother" | "child";
  members: Member[];
  otherPending: { submissionId: string; submitter: string }[];
};

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

export function namesFromSubmissionForm(form: SubmitFamilyPayload): { name: string; role: DuplicateNameHit["role"] }[] {
  const out: { name: string; role: DuplicateNameHit["role"] }[] = [];
  if (form.father.name.trim()) out.push({ name: form.father.name.trim(), role: "father" });
  for (const m of form.mothers) {
    if (m.name.trim()) out.push({ name: m.name.trim(), role: "mother" });
  }
  for (const c of form.children) {
    if (c.name.trim()) out.push({ name: c.name.trim(), role: "child" });
  }
  return out;
}

/** Names in this submission that already exist in the tree or another pending submission. */
export function findSubmissionDuplicates(
  form: SubmitFamilyPayload,
  allMembers: Member[],
  opts?: {
    excludeMemberIds?: number[];
    excludeSubmissionId?: string;
    otherSubmissions?: PendingFamilySubmission[];
  },
): DuplicateNameHit[] {
  const exclude = new Set(opts?.excludeMemberIds ?? []);
  const byName = new Map<string, Member[]>();
  for (const m of allMembers) {
    if (exclude.has(m.id)) continue;
    const k = normalizeName(m.full_name);
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push(m);
  }

  const hitMap = new Map<string, DuplicateNameHit>();

  for (const { name, role } of namesFromSubmissionForm(form)) {
    const key = normalizeName(name);
    const members = byName.get(key) ?? [];
    if (members.length > 0) {
      hitMap.set(key, { name, role, members, otherPending: [] });
    }
  }

  for (const sub of opts?.otherSubmissions ?? []) {
    if (sub.id === opts?.excludeSubmissionId) continue;
    for (const { name } of namesFromSubmissionForm(sub.form)) {
      const key = normalizeName(name);
      for (const entry of namesFromSubmissionForm(form)) {
        if (normalizeName(entry.name) !== key) continue;
        const existing = hitMap.get(key);
        const pendingRef = {
          submissionId: sub.id,
          submitter: sub.form.submitter.name || sub.form.father.name || "Unknown",
        };
        if (existing) {
          if (!existing.otherPending.some((p) => p.submissionId === sub.id)) {
            existing.otherPending.push(pendingRef);
          }
        } else {
          hitMap.set(key, {
            name: entry.name,
            role: entry.role,
            members: [],
            otherPending: [pendingRef],
          });
        }
      }
    }
  }

  return [...hitMap.values()];
}

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

export function findDuplicates(all: Member[]) {
  const map = new Map<string, Member[]>();
  all.forEach((m) => {
    const k = m.full_name.trim().toLowerCase();
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(m);
  });
  return [...map.values()].filter((v) => v.length > 1);
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
