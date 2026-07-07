import type { Member, SubmitFamilyChild } from "@/lib/family";
import { sortMembersByBirthOrder } from "@/lib/family";

export type MotherChildGroup = {
  mother: Member | null;
  motherIndex: number;
  motherLabel: string;
  children: Member[];
};

/** Sort siblings by global birth_order among the same father. */
export function sortSiblingsGlobal<T extends Pick<Member, "birth_order" | "full_name">>(children: T[]): T[] {
  return sortMembersByBirthOrder(children);
}

export function groupChildrenByMother(
  children: Member[],
  mothers: Member[],
): MotherChildGroup[] {
  const byMotherId = new Map<number | null, Member[]>();

  for (const child of children) {
    const key = child.mother_id;
    if (!byMotherId.has(key)) byMotherId.set(key, []);
    byMotherId.get(key)!.push(child);
  }

  const groups: MotherChildGroup[] = [];

  mothers.forEach((mother, motherIndex) => {
    const kids = sortSiblingsGlobal(byMotherId.get(mother.id) ?? []);
    if (kids.length === 0) return;
    groups.push({
      mother,
      motherIndex,
      motherLabel: mother.full_name,
      children: kids,
    });
    byMotherId.delete(mother.id);
  });

  for (const [motherId, kids] of byMotherId) {
    if (kids.length === 0) continue;
    groups.push({
      mother: motherId != null ? null : null,
      motherIndex: -1,
      motherLabel: motherId != null ? "Unknown mother" : "No mother",
      children: sortSiblingsGlobal(kids),
    });
  }

  return groups;
}

export type OrderedChildDraft = SubmitFamilyChild & { key: string };

export function buildOrderedChildDrafts(
  children: SubmitFamilyChild[],
): OrderedChildDraft[] {
  return children.map((c, i) => ({
    ...c,
    key: `${c.motherIndex}-${c.gender}-${c.existingId ?? "new"}-${c.name.trim().toLowerCase()}-${i}`,
  }));
}

export function motherLabelForIndex(motherNames: string[], motherIndex: number): string {
  const name = motherNames[motherIndex]?.trim();
  return name || `Mother ${motherIndex + 1}`;
}

/** Assign sequential global birth_order 1..N preserving current relative order. */
export function assignSequentialBirthOrder<T extends SubmitFamilyChild>(children: T[]): T[] {
  return children.map((c, i) => ({ ...c, birthOrder: i + 1 }));
}

/** Validate unique birth_order values 1..N among named children. */
export function validateGlobalBirthOrder(children: SubmitFamilyChild[]): void {
  const named = children.filter((c) => c.name.trim());
  if (named.length === 0) return;

  const orders = named.map((c) => c.birthOrder);
  const unique = new Set(orders);
  if (unique.size !== orders.length) {
    throw new Error("Duplicate sibling birth order — use the sibling order step to set unique ranks.");
  }

  const sorted = [...orders].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      throw new Error("Sibling birth order must be consecutive from 1 to the number of children.");
    }
  }
}
