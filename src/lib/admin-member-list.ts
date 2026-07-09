import type { FamilySort, WifeLink } from "@/lib/admin-family-units";
import type { Member } from "@/lib/family";
import { buildMap, chainReachesRoot, fatherChain, motherChain } from "@/lib/lineage";

export type MemberStatusFilter = "all" | "alive" | "dead" | "in-kin" | "out-kin";

function hasMainFamilyLineage(memberId: number, byId: Map<number, Member>): boolean {
  const member = byId.get(memberId);
  if (!member) return false;
  if (member.is_root) return true;
  if (member.father_id && chainReachesRoot(fatherChain(memberId, byId))) return true;
  if (member.mother_id && chainReachesRoot(motherChain(memberId, byId))) return true;
  return false;
}

function spouseIds(memberId: number, wives: WifeLink[]): number[] {
  return wives
    .filter((w) => w.husband_id === memberId || w.wife_id === memberId)
    .map((w) => (w.husband_id === memberId ? w.wife_id : w.husband_id));
}

/** Spouses linked to a main-lineage partner need no parent links. */
export function isCompleteByMarriage(memberId: number, wives: WifeLink[], byId: Map<number, Member>): boolean {
  return spouseIds(memberId, wives).some((id) => hasMainFamilyLineage(id, byId));
}

export function findIncompleteMembers(approved: Member[], wives: WifeLink[]): Member[] {
  const byId = buildMap(approved);
  return approved.filter(
    (m) => !m.is_root && !m.father_id && !m.mother_id && !isCompleteByMarriage(m.id, wives, byId),
  );
}

/** ponytail: runnable self-check — `bun -e "import './src/lib/admin-member-list.ts'"` */
export function assertIncompleteMemberRules() {
  const root = { id: 1, is_root: true, father_id: null, mother_id: null } as Member;
  const husband = { id: 2, is_root: false, father_id: 1, mother_id: null } as Member;
  const wife = { id: 3, is_root: false, father_id: null, mother_id: null } as Member;
  const orphan = { id: 4, is_root: false, father_id: null, mother_id: null } as Member;
  const approved = [root, husband, wife, orphan];
  const wives: WifeLink[] = [{ husband_id: 2, wife_id: 3 }];
  const incomplete = findIncompleteMembers(approved, wives);
  if (incomplete.length !== 1 || incomplete[0]!.id !== 4) {
    throw new Error("findIncompleteMembers: expected only unlinked orphan");
  }
  if (!isCompleteByMarriage(3, wives, buildMap(approved))) {
    throw new Error("findIncompleteMembers: wife should be complete by marriage");
  }
}

export function memberParentLabel(m: Member, byId: Map<number, Member>): string {
  const father = m.father_id ? byId.get(m.father_id)?.full_name : null;
  const mother = m.mother_id ? byId.get(m.mother_id)?.full_name : null;
  if (father && mother) return `${father} + ${mother}`;
  if (father) return father;
  if (mother) return mother;
  return "—";
}

export function filterAndSortMembers(
  members: Member[],
  opts: {
    query: string;
    generation: number | "all";
    status: MemberStatusFilter;
    sort: FamilySort;
  },
): Member[] {
  const q = opts.query.trim().toLowerCase();
  let list = members.filter((m) => {
    if (opts.generation !== "all" && m.generation_level !== opts.generation) return false;

    const haystack = [m.full_name, m.current_location ?? ""].join(" ").toLowerCase();
    if (q && !haystack.includes(q)) return false;

    if (opts.status === "all") return true;
    if (opts.status === "alive") return m.is_alive;
    if (opts.status === "dead") return !m.is_alive;
    if (opts.status === "in-kin") return m.is_in_kin;
    if (opts.status === "out-kin") return !m.is_in_kin;
    return true;
  });

  list = [...list].sort((a, b) => {
    switch (opts.sort) {
      case "generation-desc":
        return b.generation_level - a.generation_level || a.full_name.localeCompare(b.full_name);
      case "name-asc":
        return a.full_name.localeCompare(b.full_name);
      case "size-desc":
        return b.generation_level - a.generation_level || a.full_name.localeCompare(b.full_name);
      default:
        return a.generation_level - b.generation_level || a.full_name.localeCompare(b.full_name);
    }
  });

  return list;
}

export function countActiveMemberFilters(opts: {
  generation: string;
  status: MemberStatusFilter;
  sort: FamilySort;
  defaultSort: FamilySort;
}): number {
  let n = 0;
  if (opts.generation !== "all") n++;
  if (opts.status !== "all") n++;
  if (opts.sort !== opts.defaultSort) n++;
  return n;
}
