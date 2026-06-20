import {
  approveMemberFn,
  approveFamilySubmissionFn,
  deleteMemberFn,
  getAppSettingsFn,
  getMembersFn,
  getPendingFamilySubmissionsFn,
  getPendingFn,
  getWivesFn,
  rejectFamilySubmissionFn,
  rejectMemberFn,
  searchMembersFn,
  submitFamilyFn,
  updateApprovedFamilyFn,
  updateFamilySubmissionFn,
  updateMemberAliveFn,
  type PendingFamilySubmission,
  type SubmissionMemberIds,
} from "@/lib/api/family.functions";

export type { PendingFamilySubmission, SubmissionMemberIds };

export type Member = {
  id: number;
  full_name: string;
  gender: "male" | "female";
  father_id: number | null;
  mother_id: number | null;
  generation_level: number;
  is_in_kin: boolean;
  lineage_path_father: string;
  lineage_path_mother: string;
  is_alive: boolean;
  birth_year: number | null;
  birth_order: number | null;
  death_year: number | null;
  current_location: string | null;
  submitted_by: string | null;
  submitter_phone: string | null;
  submitter_is_alive: boolean | null;
  submitted_by_user: string | null;
  notes: string | null;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  is_root: boolean;
  created_at: string;
  updated_at: string;
};

export type StatusKind = "root" | "kinAlive" | "kinDead" | "outAlive" | "outDead";

export function statusOf(m: Pick<Member, "is_root" | "is_in_kin" | "is_alive">): StatusKind {
  if (m.is_root) return "root";
  if (m.is_in_kin) return m.is_alive ? "kinAlive" : "kinDead";
  return m.is_alive ? "outAlive" : "outDead";
}

export const statusClass: Record<StatusKind, string> = {
  root: "bg-root text-root-foreground border-root",
  kinAlive: "bg-kin-alive text-kin-alive-foreground border-kin-alive",
  kinDead: "bg-kin-dead text-kin-dead-foreground border-kin-dead",
  outAlive: "bg-out-alive text-out-alive-foreground border-out-alive",
  outDead: "bg-out-dead text-out-dead-foreground border-out-dead",
};
export const statusRing: Record<StatusKind, string> = {
  root: "ring-2 ring-root",
  kinAlive: "ring-2 ring-kin-alive",
  kinDead: "ring-2 ring-kin-dead",
  outAlive: "ring-2 ring-out-alive",
  outDead: "ring-2 ring-out-dead",
};

export type KinLinkSide = "father" | "mother";

export type SubmitFamilyParent = {
  name: string;
  alive: boolean;
  existingId: number | null;
  inKin: boolean;
  kinSide: KinLinkSide | null;
  kinAnchorId: number | null;
};

export type SubmitFamilyChild = {
  name: string;
  alive: boolean;
  gender: "male" | "female";
  birthOrder: number;
  /** 0-based index into the named mothers in the form (which tab the child was added under). */
  motherIndex: number;
  existingId?: number | null;
};

export type SubmitFamilyPayload = {
  father: SubmitFamilyParent;
  mothers: SubmitFamilyParent[];
  location: string;
  children: SubmitFamilyChild[];
  submitter: { name: string; phone: string; alive: boolean };
  notes: string;
  /** Admin-only: insert as approved immediately (ignored for non-admins). */
  autoApprove?: boolean;
};

export function sortMembersByBirthOrder<T extends Pick<Member, "birth_order" | "full_name">>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    if (a.birth_order != null && b.birth_order != null) {
      const byOrder = a.birth_order - b.birth_order;
      if (byOrder !== 0) return byOrder;
      return a.full_name.localeCompare(b.full_name);
    }
    if (a.birth_order != null) return -1;
    if (b.birth_order != null) return 1;
    return a.full_name.localeCompare(b.full_name);
  });
}

export async function fetchAllMembers(includePending = false) {
  return getMembersFn({ data: { includePending } });
}

export async function fetchPendingSubmissions() {
  return getPendingFamilySubmissionsFn();
}

export async function updateFamilySubmission(id: string, form: SubmitFamilyPayload) {
  await updateFamilySubmissionFn({ data: { id, form } });
}

export async function updateApprovedFamily(form: SubmitFamilyPayload, memberIds: SubmissionMemberIds) {
  await updateApprovedFamilyFn({ data: { form, memberIds } });
}

export async function approveFamilySubmission(id: string) {
  await approveFamilySubmissionFn({ data: { id } });
}

export async function rejectFamilySubmission(id: string) {
  await rejectFamilySubmissionFn({ data: { id } });
}

export async function fetchPending() {
  return getPendingFn();
}

export async function fetchWives() {
  return getWivesFn();
}

export async function searchMemberByName(name: string) {
  return searchMembersFn({ data: { name } });
}

export async function submitFamily(payload: SubmitFamilyPayload) {
  await submitFamilyFn({ data: payload });
  return true;
}

export async function approveMember(id: number) {
  await approveMemberFn({ data: { id } });
}

export async function rejectMember(id: number) {
  await rejectMemberFn({ data: { id } });
}

export async function deleteMember(id: number) {
  await deleteMemberFn({ data: { id } });
}

export async function updateMemberAlive(id: number, isAlive: boolean) {
  await updateMemberAliveFn({ data: { id, isAlive } });
}

export async function fetchAppSettings() {
  return getAppSettingsFn();
}
