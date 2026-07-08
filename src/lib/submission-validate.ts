import type { Member, PendingFamilySubmission, SubmitFamilyPayload } from "@/lib/family";
import { chainReachesRoot, fatherChain, motherChain } from "@/lib/lineage";
import type { ParentKinInput } from "@/lib/parent-kin";

export type DuplicateNameHit = {
  name: string;
  role: "father" | "mother" | "child";
  members: Member[];
  otherPending: { submissionId: string; submitter: string }[];
};

export function normalizeSubmitName(name: string) {
  return name.trim().toLowerCase();
}

function normalizeName(name: string) {
  return normalizeSubmitName(name);
}

export function isConfirmedDistinctName(name: string, confirmed?: string[]): boolean {
  if (!confirmed?.length) return false;
  const key = normalizeSubmitName(name);
  return confirmed.some((n) => normalizeSubmitName(n) === key);
}

export function namesFromSubmissionForm(
  form: SubmitFamilyPayload,
): { name: string; role: DuplicateNameHit["role"]; existingId: number | null }[] {
  const out: { name: string; role: DuplicateNameHit["role"]; existingId: number | null }[] = [];
  if (form.father.name.trim()) {
    out.push({ name: form.father.name.trim(), role: "father", existingId: form.father.existingId });
  }
  for (const m of form.mothers) {
    if (m.name.trim()) out.push({ name: m.name.trim(), role: "mother", existingId: m.existingId });
  }
  for (const c of form.children) {
    if (c.name.trim()) out.push({ name: c.name.trim(), role: "child", existingId: c.existingId ?? null });
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
    confirmedDistinctNames?: string[];
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

  for (const { name, role, existingId } of namesFromSubmissionForm(form)) {
    if (existingId) continue;
    const key = normalizeName(name);
    if (isConfirmedDistinctName(name, opts?.confirmedDistinctNames)) continue;
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

/** True when this parent is explicitly out of the Qadi Yonis kin tree. */
export function parentOutOfKin(parent: ParentKinInput, byId: Map<number, Member>): boolean {
  if (!parent.name.trim()) return false;
  if (parent.existingId) {
    const existing = byId.get(parent.existingId);
    return existing ? !existing.is_in_kin : false;
  }
  return parent.inKin === false;
}

/** New mother-line kin anchor (not an existing member pick). */
export function isNewMotherLineKin(parent: ParentKinInput): boolean {
  return !parent.existingId && parent.inKin === true && parent.kinSide === "mother";
}

/** Mother linked via her mother line cannot be submitted with out-of-kin co-wives. */
export function validateMotherLineCoWives(
  mothers: ParentKinInput[],
  byId: Map<number, Member>,
): boolean {
  const named = mothers.filter((m) => m.name.trim());
  const hasMotherLineKin = named.some(isNewMotherLineKin);
  if (!hasMotherLineKin) return true;
  return !named.some((m) => parentOutOfKin(m, byId));
}

export function validateNewKinLink(
  parent: ParentKinInput & { existingId?: number | null },
  byId: Map<number, Member>,
): boolean {
  if (!parent.name.trim() || parent.existingId) return true;
  if (parent.inKin === false) return true;
  if (parent.inKin !== true || !parent.kinSide || !parent.kinAnchorId) return false;
  const chain =
    parent.kinSide === "father"
      ? fatherChain(parent.kinAnchorId, byId)
      : motherChain(parent.kinAnchorId, byId);
  return chainReachesRoot(chain);
}

export function linkedMemberIdsFromForm(form: SubmitFamilyPayload): number[] {
  const ids: number[] = [];
  if (form.father.existingId) ids.push(form.father.existingId);
  for (const m of form.mothers) if (m.existingId) ids.push(m.existingId);
  for (const c of form.children) if (c.existingId) ids.push(c.existingId);
  return ids;
}

export function formHasKinLinkedParent(form: SubmitFamilyPayload, byId: Map<number, Member>): boolean {
  const fatherInKin = form.father.existingId
    ? !!byId.get(form.father.existingId)?.is_in_kin
    : !!(form.father.inKin && form.father.kinSide && form.father.kinAnchorId);
  if (fatherInKin) return true;
  return form.mothers.some((m) => {
    if (!m.name.trim()) return false;
    if (m.existingId) return !!byId.get(m.existingId)?.is_in_kin;
    return !!(m.inKin && m.kinSide && m.kinAnchorId);
  });
}
