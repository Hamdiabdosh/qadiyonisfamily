import type { SubmitFamilyChild } from "@/lib/family";

export type FormChildEntry = {
  name: string;
  alive: "alive" | "dead" | null;
  gender: "male" | "female";
  birthOrder: number;
  existingId?: number | null;
};

export type ChildrenBucket = {
  sons: FormChildEntry[];
  daughters: FormChildEntry[];
};

export function emptyChildrenBucket(): ChildrenBucket {
  return {
    sons: [{ name: "", alive: null, gender: "male", birthOrder: 1 }],
    daughters: [{ name: "", alive: null, gender: "female", birthOrder: 1 }],
  };
}

/** Next birth order within one mother's children (sons + daughters in that tab only). */
export function nextBucketBirthOrder(bucket: ChildrenBucket): number {
  const orders = [...bucket.sons, ...bucket.daughters]
    .map((c) => c.birthOrder)
    .filter((n) => n > 0);
  return orders.length ? Math.max(...orders) + 1 : 1;
}

export function flattenChildrenBuckets(buckets: Record<number, ChildrenBucket>): SubmitFamilyChild[] {
  const out: SubmitFamilyChild[] = [];
  for (const [key, bucket] of Object.entries(buckets)) {
    const motherIndex = Number(key);
    for (const s of bucket.sons) {
      if (!s.name.trim()) continue;
      out.push({
        name: s.name.trim(),
        alive: s.alive === "alive",
        gender: "male",
        birthOrder: s.birthOrder,
        motherIndex,
        existingId: s.existingId,
      });
    }
    for (const d of bucket.daughters) {
      if (!d.name.trim()) continue;
      out.push({
        name: d.name.trim(),
        alive: d.alive === "alive",
        gender: "female",
        birthOrder: d.birthOrder,
        motherIndex,
        existingId: d.existingId,
      });
    }
  }
  return out;
}

export function childrenBucketsFromFlat(
  children: Array<{
    name: string;
    alive: boolean;
    gender: "male" | "female";
    birthOrder: number;
    motherIndex?: number;
    existingId?: number | null;
  }>,
): Record<number, ChildrenBucket> {
  if (children.length === 0) return { 0: emptyChildrenBucket() };

  const buckets: Record<number, ChildrenBucket> = {};
  for (const c of children) {
    const idx = c.motherIndex ?? 0;
    if (!buckets[idx]) buckets[idx] = { sons: [], daughters: [] };
    const entry: FormChildEntry = {
      name: c.name,
      alive: c.alive ? "alive" : "dead",
      gender: c.gender,
      birthOrder: c.birthOrder,
      existingId: c.existingId,
    };
    if (c.gender === "male") buckets[idx].sons.push(entry);
    else buckets[idx].daughters.push(entry);
  }

  for (const idx of Object.keys(buckets).map(Number)) {
    const b = buckets[idx];
    if (b.sons.length === 0) b.sons = [{ name: "", alive: null, gender: "male", birthOrder: 1 }];
    if (b.daughters.length === 0) b.daughters = [{ name: "", alive: null, gender: "female", birthOrder: 1 }];
  }

  return buckets;
}

export function syncChildrenBucketsForMotherCount(
  prev: Record<number, ChildrenBucket>,
  motherCount: number,
): { buckets: Record<number, ChildrenBucket>; removedNamedChildren: number } {
  const count = Math.max(motherCount, 1);
  const next: Record<number, ChildrenBucket> = {};
  let removedNamedChildren = 0;

  for (let i = 0; i < count; i++) {
    next[i] = prev[i] ?? emptyChildrenBucket();
  }

  for (const [key, bucket] of Object.entries(prev)) {
    const idx = Number(key);
    if (idx >= count) {
      removedNamedChildren += [...bucket.sons, ...bucket.daughters].filter((c) => c.name.trim()).length;
    }
  }

  return { buckets: next, removedNamedChildren };
}
