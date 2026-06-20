import type { Member } from "@/lib/family";
import { sortMembersByBirthOrder } from "@/lib/family";

export type WifeLink = { husband_id: number; wife_id: number };

export type FamilyUnit = {
  key: string;
  generation: number;
  father: Member | null;
  mothers: Member[];
  children: Member[];
  location: string | null;
  memberIds: number[];
};

export type FamilyAnalytics = {
  total: number;
  generations: number;
  families: number;
  males: number;
  females: number;
  alive: number;
  dead: number;
};

export function buildFamilyUnits(members: Member[], wives: WifeLink[]): FamilyUnit[] {
  const approved = members.filter((m) => m.is_approved);
  const byId = new Map(approved.map((m) => [m.id, m]));
  const childrenByFather = new Map<number, Member[]>();

  for (const m of approved) {
    if (!m.father_id || !byId.has(m.father_id)) continue;
    if (!childrenByFather.has(m.father_id)) childrenByFather.set(m.father_id, []);
    childrenByFather.get(m.father_id)!.push(m);
  }

  const wivesByHusband = new Map<number, number[]>();
  for (const w of wives) {
    if (!byId.has(w.husband_id) || !byId.has(w.wife_id)) continue;
    if (!wivesByHusband.has(w.husband_id)) wivesByHusband.set(w.husband_id, []);
    wivesByHusband.get(w.husband_id)!.push(w.wife_id);
  }

  const familyFatherIds = new Set<number>();
  for (const fid of childrenByFather.keys()) familyFatherIds.add(fid);
  for (const hid of wivesByHusband.keys()) familyFatherIds.add(hid);

  const units: FamilyUnit[] = [];
  const assigned = new Set<number>();

  for (const fatherId of familyFatherIds) {
    const father = byId.get(fatherId);
    if (!father) continue;

    const mothers: Member[] = [];
    for (const wifeId of wivesByHusband.get(fatherId) ?? []) {
      const wife = byId.get(wifeId);
      if (wife) mothers.push(wife);
    }

    const children = sortMembersByBirthOrder(childrenByFather.get(fatherId) ?? []);
    for (const child of children) {
      if (child.mother_id && !mothers.some((m) => m.id === child.mother_id)) {
        const mother = byId.get(child.mother_id);
        if (mother) mothers.push(mother);
      }
    }

    const memberIds = [fatherId, ...mothers.map((m) => m.id), ...children.map((c) => c.id)];
    memberIds.forEach((id) => assigned.add(id));

    units.push({
      key: `family-${fatherId}`,
      generation: father.generation_level,
      father,
      mothers,
      children,
      location: father.current_location ?? mothers[0]?.current_location ?? children[0]?.current_location ?? null,
      memberIds,
    });
  }

  for (const m of approved) {
    if (assigned.has(m.id) || m.is_root) continue;
    units.push({
      key: `solo-${m.id}`,
      generation: m.generation_level,
      father: m.gender === "male" ? m : null,
      mothers: m.gender === "female" ? [m] : [],
      children: [],
      location: m.current_location,
      memberIds: [m.id],
    });
  }

  return units.sort((a, b) => a.generation - b.generation || familyLabel(a).localeCompare(familyLabel(b)));
}

export function familyLabel(unit: FamilyUnit): string {
  const father = unit.father?.full_name ?? "";
  const mothers = unit.mothers.map((m) => m.full_name).filter(Boolean);
  if (father && mothers.length) return `${father} & ${mothers.join(", ")}`;
  if (father) return father;
  if (mothers.length) return mothers.join(", ");
  if (unit.children.length) return unit.children.map((c) => c.full_name).join(", ");
  return "Unnamed family";
}

export function computeFamilyAnalytics(members: Member[], units: FamilyUnit[]): FamilyAnalytics {
  const approved = members.filter((m) => m.is_approved);
  return {
    total: approved.length,
    generations: new Set(approved.map((m) => m.generation_level)).size,
    families: units.filter((u) => u.children.length > 0 || u.mothers.length > 0).length,
    males: approved.filter((m) => m.gender === "male").length,
    females: approved.filter((m) => m.gender === "female").length,
    alive: approved.filter((m) => m.is_alive).length,
    dead: approved.filter((m) => !m.is_alive).length,
  };
}

export type FamilySort = "generation-asc" | "generation-desc" | "name-asc" | "size-desc";

export function filterAndSortFamilies(
  units: FamilyUnit[],
  opts: {
    query: string;
    generation: number | "all";
    status: "all" | "alive" | "dead" | "in-kin" | "out-kin";
    sort: FamilySort;
  },
): FamilyUnit[] {
  const q = opts.query.trim().toLowerCase();
  let list = units.filter((unit) => {
    if (opts.generation !== "all" && unit.generation !== opts.generation) return false;

    const names = [
      unit.father?.full_name,
      ...unit.mothers.map((m) => m.full_name),
      ...unit.children.map((c) => c.full_name),
      unit.location ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (q && !names.includes(q)) return false;

    if (opts.status === "all") return true;
    const members = [
      unit.father,
      ...unit.mothers,
      ...unit.children,
    ].filter(Boolean) as Member[];

    if (opts.status === "alive") return members.some((m) => m.is_alive);
    if (opts.status === "dead") return members.some((m) => !m.is_alive);
    if (opts.status === "in-kin") return members.some((m) => m.is_in_kin);
    if (opts.status === "out-kin") return members.some((m) => !m.is_in_kin);
    return true;
  });

  list = [...list].sort((a, b) => {
    switch (opts.sort) {
      case "generation-desc":
        return b.generation - a.generation || familyLabel(a).localeCompare(familyLabel(b));
      case "name-asc":
        return familyLabel(a).localeCompare(familyLabel(b));
      case "size-desc":
        return b.memberIds.length - a.memberIds.length || a.generation - b.generation;
      default:
        return a.generation - b.generation || familyLabel(a).localeCompare(familyLabel(b));
    }
  });

  return list;
}

export function groupFamiliesByGeneration(units: FamilyUnit[]): Map<number, FamilyUnit[]> {
  const map = new Map<number, FamilyUnit[]>();
  for (const unit of units) {
    if (!map.has(unit.generation)) map.set(unit.generation, []);
    map.get(unit.generation)!.push(unit);
  }
  return map;
}
