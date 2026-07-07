import type { Member } from "@/lib/family";

export function disambiguatorLabel(member: Member, byId: Map<number, Member>): string {
  const bits: string[] = [];
  if (member.birth_order != null) bits.push(`#${member.birth_order}`);
  if (member.father_id) {
    const father = byId.get(member.father_id);
    if (father) bits.push(`s. ${father.full_name}`);
  } else if (member.mother_id) {
    const mother = byId.get(member.mother_id);
    if (mother) bits.push(`d. ${mother.full_name}`);
  }
  bits.push(`Gen ${member.generation_level}`);
  return bits.join(" · ");
}

