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

export type OrderedSiblingItem =
  | { kind: "existing"; existingId: number; name: string; gender: "male" | "female" }
  | { kind: "draft"; draft: OrderedChildDraft };

export type SiblingOrderEntry = { existingId: number | null; tempKey: string | null };

export function buildOrderedChildDrafts(
  children: SubmitFamilyChild[],
): OrderedChildDraft[] {
  return children.map((c, i) => ({
    ...c,
    key: `${c.motherIndex}-${c.gender}-${c.existingId ?? "new"}-${c.name.trim().toLowerCase()}-${i}`,
  }));
}

export function siblingItemIdentity(item: OrderedSiblingItem): string {
  if (item.kind === "existing") return `e:${item.existingId}`;
  if (item.draft.existingId) return `e:${item.draft.existingId}`;
  return `d:${item.draft.key}`;
}

export function existingSiblingToItem(
  member: Pick<Member, "id" | "full_name" | "gender">,
): OrderedSiblingItem {
  return {
    kind: "existing",
    existingId: member.id,
    name: member.full_name,
    gender: member.gender,
  };
}

export function motherLabelForIndex(motherNames: string[], motherIndex: number): string {
  const name = motherNames[motherIndex]?.trim();
  return name || `Mother ${motherIndex + 1}`;
}

/** Assign sequential global birth_order 1..N preserving current relative order (display preview only). */
export function assignSequentialBirthOrder<T extends SubmitFamilyChild>(children: T[]): T[] {
  return children.map((c, i) => ({ ...c, birthOrder: i + 1 }));
}

export function assignSequentialDraftBirthOrder(items: OrderedSiblingItem[]): OrderedSiblingItem[] {
  let rank = 1;
  return items.map((item) => {
    if (item.kind === "existing") return item;
    return { kind: "draft", draft: { ...item.draft, birthOrder: rank++ } };
  });
}

export function siblingOrderFromItems(items: OrderedSiblingItem[]): SiblingOrderEntry[] {
  return items.map((item) => {
    if (item.kind === "existing") {
      return { existingId: item.existingId, tempKey: null };
    }
    if (item.draft.existingId) {
      return { existingId: item.draft.existingId, tempKey: null };
    }
    return { existingId: null, tempKey: item.draft.key };
  });
}

export function draftsFromOrderedItems(items: OrderedSiblingItem[]): OrderedChildDraft[] {
  return items
    .filter((item): item is { kind: "draft"; draft: OrderedChildDraft } => item.kind === "draft")
    .map((item) => item.draft);
}

/** Validate merged sibling order: unique anchors/keys and every named draft is listed. */
export function validateMergedSiblingOrder(
  items: OrderedSiblingItem[],
  namedDrafts: SubmitFamilyChild[],
): void {
  const seenIds = new Set<number>();
  const seenKeys = new Set<string>();

  for (const item of items) {
    if (item.kind === "existing") {
      if (seenIds.has(item.existingId)) {
        throw new Error("Duplicate sibling in order list.");
      }
      seenIds.add(item.existingId);
      continue;
    }

    if (item.draft.existingId) {
      if (seenIds.has(item.draft.existingId)) {
        throw new Error("Duplicate sibling in order list.");
      }
      seenIds.add(item.draft.existingId);
    } else {
      if (seenKeys.has(item.draft.key)) {
        throw new Error("Duplicate sibling in order list.");
      }
      seenKeys.add(item.draft.key);
    }
  }

  const orderedDrafts = buildOrderedChildDrafts(namedDrafts);
  for (const draft of orderedDrafts) {
    const listed = draft.existingId
      ? seenIds.has(draft.existingId)
      : seenKeys.has(draft.key);
    if (!listed) {
      throw new Error("Every child must have a position in the sibling order list.");
    }
  }
}

/** @deprecated Use validateMergedSiblingOrder — kept for callers still passing flat drafts only. */
export function validateGlobalBirthOrder(children: SubmitFamilyChild[]): void {
  validateMergedSiblingOrder(
    buildOrderedChildDrafts(children).map((draft) => ({ kind: "draft", draft })),
    children,
  );
}

export const SIBLING_BIRTH_ORDER_SPACING = 1000;
