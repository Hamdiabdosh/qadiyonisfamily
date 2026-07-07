import { chainReachesRoot, fatherChain, motherChain } from "@/lib/lineage";
import type { Member } from "@/lib/family";

export type LineageParent = {
  fullName: string;
  isInKin: boolean;
  generationLevel: number;
  lineagePathFather: string;
  lineagePathMother: string;
};

export type WifeLink = { husband_id: number; wife_id: number };

/** True when this person is on the main Qadi Yonis tree via father or mother line. */
export function hasMainFamilyLineage(memberId: number, byId: Map<number, Member>): boolean {
  const member = byId.get(memberId);
  if (!member) return false;
  if (member.is_root) return true;
  if (member.father_id && chainReachesRoot(fatherChain(memberId, byId))) return true;
  if (member.mother_id && chainReachesRoot(motherChain(memberId, byId))) return true;
  return false;
}

/**
 * Spouses without their own main-family lineage inherit their partner's generation
 * (same gen, not +1). Lineage always wins when the person already links to root.
 */
export function resolveGenerationLevel(
  memberId: number,
  lineageGeneration: number,
  byId: Map<number, Member>,
  wives: WifeLink[],
): number {
  const member = byId.get(memberId);
  if (!member || member.is_root) return lineageGeneration;
  if (hasMainFamilyLineage(memberId, byId)) return lineageGeneration;

  let spouseGen: number | null = null;
  for (const link of wives) {
    const spouseId =
      link.wife_id === memberId ? link.husband_id : link.husband_id === memberId ? link.wife_id : null;
    if (spouseId == null) continue;
    const spouse = byId.get(spouseId);
    if (!spouse || !hasMainFamilyLineage(spouseId, byId)) continue;
    if (spouseGen == null || spouse.generation_level > spouseGen) {
      spouseGen = spouse.generation_level;
    }
  }

  return spouseGen ?? lineageGeneration;
}

export function computeLineageFields(
  fullName: string,
  isRoot: boolean,
  father?: LineageParent | null,
  mother?: LineageParent | null,
) {
  if (isRoot) {
    return {
      generationLevel: 1,
      isInKin: true,
      lineagePathFather: fullName,
      lineagePathMother: fullName,
    };
  }

  let fInKin = false;
  let mInKin = false;
  let fGen = 0;
  let mGen = 0;
  let lineagePathFather = "No path";
  let lineagePathMother = "No path";

  if (father) {
    fInKin = father.isInKin;
    fGen = father.generationLevel;
    if (fInKin) lineagePathFather = `${father.lineagePathFather} > ${fullName}`;
  }

  if (mother) {
    mInKin = mother.isInKin;
    mGen = mother.generationLevel;
    if (mInKin) {
      lineagePathMother =
        mother.lineagePathFather !== "No path"
          ? `${mother.lineagePathFather} > ${fullName}`
          : `${mother.lineagePathMother} > ${fullName}`;
    }
  }

  const generationLevel = Math.max(fGen, mGen) + 1;
  return {
    generationLevel: generationLevel < 1 ? 1 : generationLevel,
    isInKin: fInKin || mInKin,
    lineagePathFather,
    lineagePathMother,
  };
}

/** ponytail: runnable self-check — `bun run scripts/check-marriage-generation.ts` */
export function assertMarriageGenerationRules() {
  const stub = (
    id: number,
    overrides: Partial<Member> & Pick<Member, "full_name" | "gender" | "father_id" | "mother_id" | "generation_level" | "is_in_kin" | "is_root">,
  ): Member => ({
    id,
    birth_year: null,
    birth_order: null,
    death_year: null,
    current_location: null,
    photo_url: null,
    submitted_by: null,
    submitter_phone: null,
    submitter_is_alive: null,
    submitted_by_user: null,
    notes: null,
    is_approved: true,
    approved_by: null,
    approved_at: null,
    created_at: "",
    updated_at: "",
    lineage_path_father: overrides.is_in_kin ? "path" : "No path",
    lineage_path_mother: overrides.is_in_kin ? "path" : "No path",
    is_alive: true,
    ...overrides,
  });

  const root = stub(1, {
    full_name: "Root",
    gender: "male",
    father_id: null,
    mother_id: null,
    generation_level: 1,
    is_in_kin: true,
    is_root: true,
  });
  const abdosh = stub(2, {
    full_name: "Abdosh",
    gender: "male",
    father_id: 1,
    mother_id: null,
    generation_level: 3,
    is_in_kin: true,
    is_root: false,
  });
  const muna = stub(3, {
    full_name: "Muna",
    gender: "female",
    father_id: null,
    mother_id: null,
    generation_level: 1,
    is_in_kin: false,
    is_root: false,
  });
  const melika = stub(4, {
    full_name: "Melika",
    gender: "female",
    father_id: 1,
    mother_id: null,
    generation_level: 2,
    is_in_kin: true,
    is_root: false,
  });

  const byId = new Map<number, Member>([
    [1, root],
    [2, abdosh],
    [3, muna],
    [4, melika],
  ]);

  const munaGen = resolveGenerationLevel(3, 1, byId, [{ husband_id: 2, wife_id: 3 }]);
  if (munaGen !== 3) throw new Error(`expected Muna gen 3, got ${munaGen}`);

  const melikaGen = resolveGenerationLevel(4, 2, byId, [{ husband_id: 2, wife_id: 4 }]);
  if (melikaGen !== 2) throw new Error(`expected Melika to keep gen 2, got ${melikaGen}`);
}
