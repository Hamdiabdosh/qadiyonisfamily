import type { ChildrenBucket } from "@/lib/children-by-mother";
import type { Member } from "@/lib/family";
import { normalizeSubmitName, type DuplicateNameHit } from "@/lib/submission-validate";

export type ParentEntry = {
  name: string;
  alive: "alive" | "dead" | null;
  existingId: number | null;
  inKin: boolean | null;
  kinSide: "father" | "mother" | null;
  kinAnchorId: number | null;
  photo: { base64: string; mimeType: string } | null;
};

export function linkDuplicateEntry(
  hit: DuplicateNameHit,
  memberId: number,
  allMembers: Member[],
  form: {
    father: ParentEntry;
    mothers: ParentEntry[];
    childrenByMother: Record<number, ChildrenBucket>;
  },
) {
  const member = allMembers.find((m) => m.id === memberId);
  if (!member) return form;

  const norm = normalizeSubmitName(hit.name);
  const alive = member.is_alive ? ("alive" as const) : ("dead" as const);
  const linkedParent = {
    name: member.full_name,
    existingId: member.id,
    alive,
    inKin: member.is_in_kin,
    kinSide: null,
    kinAnchorId: null,
    photo: null,
  };

  if (hit.role === "father") {
    return { ...form, father: linkedParent };
  }

  if (hit.role === "mother") {
    const mothers = [...form.mothers];
    const idx = mothers.findIndex((m) => normalizeSubmitName(m.name) === norm && !m.existingId);
    if (idx === -1) return form;
    mothers[idx] = linkedParent;
    return { ...form, mothers };
  }

  const childrenByMother = { ...form.childrenByMother };
  for (const [key, bucket] of Object.entries(childrenByMother)) {
    for (const list of ["sons", "daughters"] as const) {
      const arr = bucket[list];
      const idx = arr.findIndex((c) => normalizeSubmitName(c.name) === norm && !c.existingId);
      if (idx === -1) continue;
      const nextBucket = { ...bucket, [list]: [...arr] };
      nextBucket[list][idx] = {
        ...nextBucket[list][idx],
        name: member.full_name,
        existingId: member.id,
        alive,
      };
      childrenByMother[Number(key)] = nextBucket;
      return { ...form, childrenByMother };
    }
  }

  return form;
}
