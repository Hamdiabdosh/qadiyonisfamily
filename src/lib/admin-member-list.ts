import type { Member } from "@/lib/family";
import type { FamilySort } from "@/lib/admin-family-units";

export type MemberStatusFilter = "all" | "alive" | "dead" | "in-kin" | "out-kin";

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
