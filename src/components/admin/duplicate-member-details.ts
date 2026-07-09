import type { Member } from "@/lib/family";

export type ChildrenCounts = { asFather: number; asMother: number };

export type DuplicateDetailField = {
  key: string;
  label: string;
  value: string;
};

export function buildChildrenCounts(all: Member[]): Map<number, ChildrenCounts> {
  const map = new Map<number, ChildrenCounts>();
  const bump = (id: number, role: "asFather" | "asMother") => {
    const cur = map.get(id) ?? { asFather: 0, asMother: 0 };
    cur[role] += 1;
    map.set(id, cur);
  };
  for (const m of all) {
    if (m.father_id) bump(m.father_id, "asFather");
    if (m.mother_id) bump(m.mother_id, "asMother");
  }
  return map;
}

function shortenLineage(path: string): string {
  if (!path || path === "No path") return "—";
  const parts = path.split(/\s*>\s*/).filter(Boolean);
  if (parts.length <= 4) return parts.join(" → ");
  return `${parts.slice(0, 2).join(" → ")} → … → ${parts[parts.length - 1]}`;
}

function parentName(byId: Map<number, Member>, id: number | null): string {
  if (!id) return "—";
  return byId.get(id)?.full_name ?? `#${id}`;
}

export function duplicateDetailFields(
  member: Member,
  byId: Map<number, Member>,
  children: ChildrenCounts | undefined,
): DuplicateDetailField[] {
  const childBits: string[] = [];
  if (children?.asFather) childBits.push(`${children.asFather} as father`);
  if (children?.asMother) childBits.push(`${children.asMother} as mother`);

  const fields: DuplicateDetailField[] = [
    { key: "id", label: "Record ID", value: `#${member.id}` },
    { key: "gender", label: "Gender", value: member.gender === "male" ? "Male" : "Female" },
    { key: "approval", label: "Approval", value: member.is_approved ? "Approved" : "Pending" },
    { key: "father", label: "Father", value: parentName(byId, member.father_id) },
    { key: "mother", label: "Mother", value: parentName(byId, member.mother_id) },
    { key: "generation", label: "Generation", value: String(member.generation_level) },
    { key: "birth_order", label: "Birth order", value: member.birth_order != null ? `#${member.birth_order}` : "—" },
    { key: "birth_year", label: "Birth year", value: member.birth_year != null ? String(member.birth_year) : "—" },
    {
      key: "alive",
      label: "Alive status",
      value: member.is_alive ? "Alive" : member.death_year != null ? `Deceased (${member.death_year})` : "Deceased",
    },
    { key: "in_kin", label: "In kin", value: member.is_in_kin ? "Yes" : "No" },
    { key: "location", label: "Location", value: member.current_location?.trim() || "—" },
    { key: "children", label: "Linked children", value: childBits.length ? childBits.join(", ") : "None" },
    { key: "photo", label: "Photo", value: member.photo_url ? "Yes" : "No" },
    {
      key: "submitter",
      label: "Submitted by",
      value: [member.submitted_by, member.submitter_phone].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "dates",
      label: "Created",
      value: member.created_at ? new Date(member.created_at).toLocaleDateString() : "—",
    },
    {
      key: "lineage_father",
      label: "Father line",
      value: shortenLineage(member.lineage_path_father),
    },
    {
      key: "lineage_mother",
      label: "Mother line",
      value: shortenLineage(member.lineage_path_mother),
    },
  ];

  if (member.notes?.trim()) {
    fields.push({ key: "notes", label: "Notes", value: member.notes.trim() });
  }

  return fields;
}

/** Higher score = more likely the canonical record to keep. */
export function keepScore(member: Member, children: ChildrenCounts | undefined): number {
  if (member.is_root) return 10_000;
  let score = 0;
  if (member.is_approved) score += 50;
  if (member.photo_url) score += 20;
  if (member.father_id) score += 12;
  if (member.mother_id) score += 8;
  if (member.is_in_kin) score += 10;
  if (member.birth_year != null) score += 5;
  if (member.current_location?.trim()) score += 4;
  if (member.birth_order != null) score += 3;
  score += (children?.asFather ?? 0) * 8;
  score += (children?.asMother ?? 0) * 6;
  // ponytail: prefer older record when otherwise tied
  score -= member.id * 0.001;
  if (!member.is_approved) score -= 40;
  return score;
}

export function pickSuggestedKeep(group: Member[], childrenMap: Map<number, ChildrenCounts>): Member {
  return [...group].sort(
    (a, b) => keepScore(b, childrenMap.get(b.id)) - keepScore(a, childrenMap.get(a.id)),
  )[0];
}

export function fieldDiffKeys(groups: DuplicateDetailField[][]): Set<string> {
  const byKey = new Map<string, Set<string>>();
  for (const fields of groups) {
    for (const f of fields) {
      if (!byKey.has(f.key)) byKey.set(f.key, new Set());
      byKey.get(f.key)!.add(f.value);
    }
  }
  const diff = new Set<string>();
  for (const [key, values] of byKey) {
    if (values.size > 1) diff.add(key);
  }
  return diff;
}
