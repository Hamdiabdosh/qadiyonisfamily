import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/index.server";
import { appSettings, familyMembers, familySubmissions, memberWives, notifications, users } from "@/db/schema";
import { optionalAuth, requireAdmin, requireAuth } from "@/lib/auth-middleware.server";
import { createAdminAlert } from "@/lib/admin-notify.server";
import { toMember } from "@/lib/db-mapper";
import { collectKinLinkJumps, formatKinLinkJumpsSummary } from "@/lib/kin-anchor";
import { buildMap, chainReachesRoot, fatherChain, motherChain } from "@/lib/lineage";
import { computeLineageFields } from "@/lib/lineage-compute.server";
import { recomputeMemberLineage } from "@/lib/lineage-recompute.server";
import { saveMemberPhoto } from "@/lib/uploads.server";

const parentSchema = z.object({
  name: z.string(),
  alive: z.boolean(),
  existingId: z.number().nullable(),
  inKin: z.boolean(),
  kinSide: z.enum(["father", "mother"]).nullable(),
  kinAnchorId: z.number().nullable(),
});

const submitPayloadSchema = z.object({
  father: parentSchema,
  mothers: z.array(parentSchema),
  location: z.string(),
  children: z.array(
    z.object({
      name: z.string(),
      alive: z.boolean(),
      gender: z.enum(["male", "female"]),
      birthOrder: z.number().int().min(1),
      motherIndex: z.number().int().min(0).optional().default(0),
      existingId: z.number().nullable().optional(),
    }),
  ),
  submitter: z.object({
    name: z.string(),
    phone: z.string(),
    alive: z.boolean(),
  }),
  notes: z.string(),
  autoApprove: z.boolean().optional(),
});

export type SubmissionMemberIds = {
  fatherId: number | null;
  motherIds: number[];
  childIds: number[];
};

export type PendingFamilySubmission = {
  id: string;
  created_at: string;
  submitted_by_user: string | null;
  form: z.infer<typeof submitPayloadSchema>;
  member_ids: SubmissionMemberIds;
  legacy: boolean;
};

async function getMemberById(id: number) {
  const db = getDb();
  const [row] = await db.select().from(familyMembers).where(eq(familyMembers.id, id)).limit(1);
  return row ?? null;
}

async function parentGetsLocation(parent: z.infer<typeof parentSchema>): Promise<boolean> {
  if (!parent.name.trim()) return false;
  if (parent.existingId) {
    const row = await getMemberById(parent.existingId);
    return row?.isInKin ?? false;
  }
  return !!(parent.inKin && parent.kinSide && parent.kinAnchorId);
}

function resolveChildMotherId(motherIds: number[], motherIndex: number): number | null {
  if (motherIds.length === 0) return null;
  if (motherIndex < 0 || motherIndex >= motherIds.length) {
    throw new Error("Invalid mother selection for a child");
  }
  return motherIds[motherIndex] ?? null;
}

function assertGlobalSiblingOrder(children: z.infer<typeof submitPayloadSchema>["children"]) {
  const named = children.filter((c) => c.name.trim());
  if (named.length === 0) return;
  const orders = named.map((c) => c.birthOrder);
  const uniq = new Set(orders);
  if (uniq.size !== orders.length) {
    throw new Error("Duplicate sibling birth order — each child must have a unique rank.");
  }
  const sorted = [...orders].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      throw new Error("Sibling birth order must be consecutive from 1 to the number of children.");
    }
  }
}

async function findMemberByName(name: string) {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) return null;
  const rows = await db
    .select()
    .from(familyMembers)
    .where(ilike(familyMembers.fullName, trimmed));
  return rows.find((r) => r.fullName.trim().toLowerCase() === trimmed.toLowerCase()) ?? null;
}

function isNewMotherLineKin(parent: z.infer<typeof parentSchema>): boolean {
  return !parent.existingId && parent.inKin && parent.kinSide === "mother";
}

function validateNewKinLink(
  parent: z.infer<typeof parentSchema>,
  byId: Map<number, ReturnType<typeof toMember>>,
): boolean {
  if (!parent.name.trim() || parent.existingId) return true;
  if (!parent.inKin) return true;
  if (!parent.kinSide || !parent.kinAnchorId) return false;
  const chain =
    parent.kinSide === "father"
      ? fatherChain(parent.kinAnchorId, byId)
      : motherChain(parent.kinAnchorId, byId);
  return chainReachesRoot(chain);
}

async function resolveParentInKin(parent: z.infer<typeof parentSchema>): Promise<boolean> {
  if (!parent.name.trim()) return false;
  if (parent.existingId) {
    const row = await getMemberById(parent.existingId);
    return row?.isInKin ?? false;
  }
  return !!(parent.inKin && parent.kinSide && parent.kinAnchorId);
}

async function loadMembersByIdMap() {
  const db = getDb();
  const rows = await db.select().from(familyMembers);
  return buildMap(rows.map(toMember));
}

async function assertSubmitFamilyValid(data: z.infer<typeof submitPayloadSchema>) {
  assertGlobalSiblingOrder(data.children);
  const namedMothers = data.mothers.filter((m) => m.name.trim());
  const hasMotherLineKin = namedMothers.some((m) => isNewMotherLineKin(m));
  if (hasMotherLineKin) {
    for (const m of namedMothers) {
      if (!(await resolveParentInKin(m))) {
        throw new Error(
          "A mother linked through her mother line cannot be submitted with out-of-kin co-wives.",
        );
      }
    }
  }

  const byId = await loadMembersByIdMap();
  if (!validateNewKinLink(data.father, byId)) {
    throw new Error("Father kin link does not reach the root ancestor.");
  }
  for (const m of namedMothers) {
    if (!validateNewKinLink(m, byId)) {
      throw new Error("Mother kin link does not reach the root ancestor.");
    }
  }

  const linkedIds = new Set<number>();
  if (data.father.existingId) linkedIds.add(data.father.existingId);
  for (const m of data.mothers) if (m.existingId) linkedIds.add(m.existingId);
  for (const c of data.children) if (c.existingId) linkedIds.add(c.existingId);

  const assertNameAvailable = async (
    name: string,
    existingId: number | null | undefined,
    role: string,
  ) => {
    const trimmed = name.trim();
    if (!trimmed || existingId) return;
    const hit = await findMemberByName(trimmed);
    if (hit && !linkedIds.has(hit.id)) {
      throw new Error(
        `"${trimmed}" already exists (${role}) — search and select them from the list instead of typing a new name.`,
      );
    }
  };

  await assertNameAvailable(data.father.name, data.father.existingId, "father");
  for (const m of data.mothers) await assertNameAvailable(m.name, m.existingId, "mother");
  for (const c of data.children) await assertNameAvailable(c.name, c.existingId, "child");
}

async function insertMember(
  values: {
    fullName: string;
    gender: "male" | "female";
    fatherId?: number | null;
    motherId?: number | null;
    isAlive: boolean;
    currentLocation?: string | null;
    submittedBy?: string | null;
    submitterPhone?: string | null;
    submitterIsAlive?: boolean;
    submittedByUser?: string | null;
    notes?: string | null;
    isApproved?: boolean;
    approvedBy?: string | null;
    isRoot?: boolean;
    birthOrder?: number | null;
    submissionId?: string | null;
  },
) {
  const db = getDb();
  const father = values.fatherId ? await getMemberById(values.fatherId) : null;
  const mother = values.motherId ? await getMemberById(values.motherId) : null;
  const lineage = computeLineageFields(
    values.fullName,
    values.isRoot ?? false,
    father
      ? {
          fullName: father.fullName,
          isInKin: father.isInKin,
          generationLevel: father.generationLevel,
          lineagePathFather: father.lineagePathFather,
          lineagePathMother: father.lineagePathMother,
        }
      : null,
    mother
      ? {
          fullName: mother.fullName,
          isInKin: mother.isInKin,
          generationLevel: mother.generationLevel,
          lineagePathFather: mother.lineagePathFather,
          lineagePathMother: mother.lineagePathMother,
        }
      : null,
  );

  const [row] = await db
    .insert(familyMembers)
    .values({
      fullName: values.fullName,
      gender: values.gender,
      fatherId: values.fatherId ?? null,
      motherId: values.motherId ?? null,
      isAlive: values.isAlive,
      birthOrder: values.birthOrder ?? null,
      currentLocation: values.currentLocation ?? null,
      submittedBy: values.submittedBy ?? null,
      submitterPhone: values.submitterPhone ?? null,
      submitterIsAlive: values.submitterIsAlive ?? true,
      submittedByUser: values.submittedByUser ?? null,
      notes: values.notes ?? null,
      isApproved: values.isApproved ?? false,
      approvedAt: values.isApproved ? new Date() : null,
      approvedBy: values.isApproved ? (values.approvedBy ?? null) : null,
      isRoot: values.isRoot ?? false,
      submissionId: values.submissionId ?? null,
      generationLevel: lineage.generationLevel,
      isInKin: lineage.isInKin,
      lineagePathFather: lineage.lineagePathFather,
      lineagePathMother: lineage.lineagePathMother,
    })
    .returning();

  return row;
}

export const getMembersFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ includePending: z.boolean().optional() }).optional())
  .middleware([optionalAuth])
  .handler(async ({ data, context }) => {
    const db = getDb();
    const includePending = data?.includePending ?? false;
    const rows = await db
      .select()
      .from(familyMembers)
      .orderBy(asc(familyMembers.generationLevel), asc(familyMembers.fullName));

    if (!context.isAuthenticated) {
      return rows.filter((row) => row.isApproved).map(toMember);
    }

    const filtered = rows.filter((row) => {
      if (row.isApproved) return true;
      if (!includePending) return false;
      if (context.isAdmin) return true;
      return row.submittedByUser === context.userId;
    });

    return filtered.map(toMember);
  });

export const getPendingFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.isApproved, false))
      .orderBy(desc(familyMembers.createdAt));
    return rows.map(toMember);
  });

function parseSubmissionRow(row: typeof familySubmissions.$inferSelect): PendingFamilySubmission {
  return {
    id: row.id,
    created_at: row.createdAt.toISOString(),
    submitted_by_user: row.submittedByUser,
    form: submitPayloadSchema.parse(JSON.parse(row.formData)),
    member_ids: JSON.parse(row.memberIds) as SubmissionMemberIds,
    legacy: false,
  };
}

function groupLegacyPending(members: Awaited<ReturnType<typeof toMember>>[]): PendingFamilySubmission[] {
  const buckets = new Map<string, typeof members>();
  for (const m of members) {
    const minute = m.created_at.slice(0, 16);
    const key = `${m.submitted_by_user ?? ""}|${m.submitter_phone ?? ""}|${m.submitted_by ?? ""}|${minute}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(m);
  }

  return [...buckets.values()].map((group) => {
    const sorted = [...group].sort((a, b) => a.id - b.id);
    const children = sorted.filter((m) => m.father_id != null);
    const childIdSet = new Set(children.map((c) => c.id));
    const fatherLinkId = children[0]?.father_id ?? null;
    const father =
      sorted.find((m) => m.id === fatherLinkId) ??
      sorted.find((m) => m.gender === "male" && !childIdSet.has(m.id));
    const mothers = sorted.filter(
      (m) => m.gender === "female" && m.id !== father?.id && !childIdSet.has(m.id),
    );
    const first = sorted[0];

    const form: z.infer<typeof submitPayloadSchema> = {
      father: {
        name: father?.full_name ?? "",
        alive: father?.is_alive ?? true,
        existingId: father?.is_approved ? father.id : null,
        inKin: father?.is_in_kin ?? false,
        kinSide: null,
        kinAnchorId: null,
      },
      mothers: mothers.length
        ? mothers.map((m) => ({
            name: m.full_name,
            alive: m.is_alive,
            existingId: m.is_approved ? m.id : null,
            inKin: m.is_in_kin,
            kinSide: null,
            kinAnchorId: null,
          }))
        : [{ name: "", alive: true, existingId: null, inKin: false, kinSide: null, kinAnchorId: null }],
      location: first.current_location ?? "",
      children: children.map((c) => {
        const motherIdx = mothers.findIndex((m) => m.id === c.mother_id);
        return {
          name: c.full_name,
          alive: c.is_alive,
          gender: c.gender,
          birthOrder: c.birth_order ?? 1,
          motherIndex: motherIdx >= 0 ? motherIdx : 0,
        };
      }),
      submitter: {
        name: first.submitted_by ?? "",
        phone: first.submitter_phone ?? "",
        alive: first.submitter_is_alive ?? true,
      },
      notes: sorted.find((m) => m.notes)?.notes ?? "",
    };

    return {
      id: `legacy-${sorted.map((m) => m.id).join("-")}`,
      created_at: first.created_at,
      submitted_by_user: first.submitted_by_user,
      form,
      member_ids: {
        fatherId: father && !father.is_approved ? father.id : null,
        motherIds: mothers.filter((m) => !m.is_approved).map((m) => m.id),
        childIds: children.filter((c) => !c.is_approved).map((c) => c.id),
      },
      legacy: true,
    };
  });
}

export const getPendingFamilySubmissionsFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(familySubmissions)
      .where(eq(familySubmissions.status, "pending"))
      .orderBy(desc(familySubmissions.createdAt));

    const submissions = rows.map(parseSubmissionRow);

    const orphanRows = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.isApproved, false), isNull(familyMembers.submissionId)))
      .orderBy(desc(familyMembers.createdAt));

    if (orphanRows.length > 0) {
      submissions.push(...groupLegacyPending(orphanRows.map(toMember)));
    }

    return submissions;
  });

async function patchPendingMember(
  id: number,
  values: Partial<{
    fullName: string;
    isAlive: boolean;
    gender: "male" | "female";
    birthOrder: number | null;
    currentLocation: string | null;
    submittedBy: string | null;
    submitterPhone: string | null;
    notes: string | null;
    fatherId: number | null;
    motherId: number | null;
  }>,
) {
  const db = getDb();
  const member = await getMemberById(id);
  if (!member || member.isApproved) return;

  await db
    .update(familyMembers)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(familyMembers.id, id));

  await recomputeMemberLineage(id);
}

async function patchMember(
  id: number,
  values: Partial<{
    fullName: string;
    isAlive: boolean;
    gender: "male" | "female";
    birthOrder: number | null;
    currentLocation: string | null;
    submittedBy: string | null;
    submitterPhone: string | null;
    notes: string | null;
    fatherId: number | null;
    motherId: number | null;
  }>,
) {
  const db = getDb();
  await db
    .update(familyMembers)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(familyMembers.id, id));

  await recomputeMemberLineage(id);
}

async function syncSubmissionMembers(
  submissionId: string,
  form: z.infer<typeof submitPayloadSchema>,
  memberIds: SubmissionMemberIds,
  submittedByUser: string | null,
): Promise<SubmissionMemberIds> {
  assertGlobalSiblingOrder(form.children);
  const db = getDb();
  const submitter = form.submitter;
  const locationStr = form.location || null;
  const fatherGetsLocation = await parentGetsLocation(form.father);
  const motherGetsLocation = await Promise.all(form.mothers.map((m) => parentGetsLocation(m)));
  const anyKinParent = fatherGetsLocation || motherGetsLocation.some(Boolean);
  const childLocation = anyKinParent ? locationStr : null;
  const submitMeta = {
    submittedBy: submitter.name || null,
    submitterPhone: submitter.phone || null,
    submitterIsAlive: submitter.alive,
    submittedByUser,
  };

  if (memberIds.fatherId && form.father.name.trim()) {
    await patchPendingMember(memberIds.fatherId, {
      fullName: form.father.name.trim(),
      isAlive: form.father.alive,
      currentLocation: fatherGetsLocation ? locationStr : null,
      ...submitMeta,
    });
  }

  let fatherLinkId = memberIds.fatherId ?? form.father.existingId;
  const nextMotherIds: number[] = [];

  for (let i = 0; i < form.mothers.length; i++) {
    const mo = form.mothers[i];
    if (!mo.name.trim()) continue;
    const existingId = memberIds.motherIds[i];
    if (existingId) {
      await patchPendingMember(existingId, {
        fullName: mo.name.trim(),
        isAlive: mo.alive,
        currentLocation: motherGetsLocation[i] ? locationStr : null,
        ...submitMeta,
      });
      nextMotherIds.push(existingId);
      continue;
    }
    const row = await insertMember({
      fullName: mo.name.trim(),
      gender: "female",
      isAlive: mo.alive,
      submissionId,
      currentLocation: motherGetsLocation[i] ? locationStr : null,
      ...submitMeta,
    });
    nextMotherIds.push(row.id);
    if (fatherLinkId) {
      await db
        .insert(memberWives)
        .values({ husbandId: fatherLinkId, wifeId: row.id })
        .onConflictDoNothing({ target: [memberWives.husbandId, memberWives.wifeId] });
      await recomputeMemberLineage(row.id);
    }
  }

  for (const removedId of memberIds.motherIds.filter((id) => !nextMotherIds.includes(id))) {
    await db.delete(familyMembers).where(eq(familyMembers.id, removedId));
  }
  memberIds.motherIds = nextMotherIds;

  const nextChildIds: number[] = [];
  const namedChildren = form.children.filter((c) => c.name.trim());

  for (let i = 0; i < namedChildren.length; i++) {
    const kid = namedChildren[i];
    const motherId = resolveChildMotherId(nextMotherIds, kid.motherIndex);
    const existingId = memberIds.childIds[i];
    if (existingId) {
      await patchPendingMember(existingId, {
        fullName: kid.name.trim(),
        isAlive: kid.alive,
        gender: kid.gender,
        birthOrder: kid.birthOrder,
        fatherId: fatherLinkId,
        motherId,
        notes: form.notes || null,
        currentLocation: childLocation,
        ...submitMeta,
      });
      nextChildIds.push(existingId);
      continue;
    }
    const row = await insertMember({
      fullName: kid.name.trim(),
      gender: kid.gender,
      isAlive: kid.alive,
      birthOrder: kid.birthOrder,
      fatherId: fatherLinkId,
      motherId,
      notes: form.notes || null,
      submissionId,
      currentLocation: childLocation,
      ...submitMeta,
    });
    nextChildIds.push(row.id);
  }

  for (const removedId of memberIds.childIds.filter((id) => !nextChildIds.includes(id))) {
    await db.delete(familyMembers).where(eq(familyMembers.id, removedId));
  }
  memberIds.childIds = nextChildIds;

  return memberIds;
}

async function syncApprovedFamilyMembers(
  form: z.infer<typeof submitPayloadSchema>,
  memberIds: SubmissionMemberIds,
  submittedByUser: string | null,
): Promise<SubmissionMemberIds> {
  assertGlobalSiblingOrder(form.children);
  const db = getDb();
  const submitter = form.submitter;
  const locationStr = form.location || null;
  const fatherGetsLocation = await parentGetsLocation(form.father);
  const motherGetsLocation = await Promise.all(form.mothers.map((m) => parentGetsLocation(m)));
  const anyKinParent = fatherGetsLocation || motherGetsLocation.some(Boolean);
  const childLocation = anyKinParent ? locationStr : null;
  const submitMeta = {
    submittedBy: submitter.name || null,
    submitterPhone: submitter.phone || null,
    submitterIsAlive: submitter.alive,
    submittedByUser,
  };

  if (memberIds.fatherId && form.father.name.trim()) {
    await patchMember(memberIds.fatherId, {
      fullName: form.father.name.trim(),
      isAlive: form.father.alive,
      currentLocation: fatherGetsLocation ? locationStr : null,
      ...submitMeta,
    });
  }

  let fatherLinkId = memberIds.fatherId ?? form.father.existingId;
  const nextMotherIds: number[] = [];

  for (let i = 0; i < form.mothers.length; i++) {
    const mo = form.mothers[i];
    if (!mo.name.trim()) continue;
    const existingId = memberIds.motherIds[i];
    if (existingId) {
      await patchMember(existingId, {
        fullName: mo.name.trim(),
        isAlive: mo.alive,
        currentLocation: motherGetsLocation[i] ? locationStr : null,
        ...submitMeta,
      });
      nextMotherIds.push(existingId);
      continue;
    }
    const row = await insertMember({
      fullName: mo.name.trim(),
      gender: "female",
      isAlive: mo.alive,
      currentLocation: motherGetsLocation[i] ? locationStr : null,
      isApproved: true,
      approvedBy: submittedByUser,
      ...submitMeta,
    });
    nextMotherIds.push(row.id);
    if (fatherLinkId) {
      await db
        .insert(memberWives)
        .values({ husbandId: fatherLinkId, wifeId: row.id })
        .onConflictDoNothing({ target: [memberWives.husbandId, memberWives.wifeId] });
      await recomputeMemberLineage(row.id);
    }
  }

  for (const removedId of memberIds.motherIds.filter((id) => !nextMotherIds.includes(id))) {
    await db.delete(familyMembers).where(eq(familyMembers.id, removedId));
  }
  memberIds.motherIds = nextMotherIds;

  const nextChildIds: number[] = [];
  const namedChildren = form.children.filter((c) => c.name.trim());

  for (let i = 0; i < namedChildren.length; i++) {
    const kid = namedChildren[i];
    const motherId = resolveChildMotherId(nextMotherIds, kid.motherIndex);
    const existingId = memberIds.childIds[i];
    if (existingId) {
      await patchMember(existingId, {
        fullName: kid.name.trim(),
        isAlive: kid.alive,
        gender: kid.gender,
        birthOrder: kid.birthOrder,
        fatherId: fatherLinkId,
        motherId,
        notes: form.notes || null,
        currentLocation: childLocation,
        ...submitMeta,
      });
      nextChildIds.push(existingId);
      continue;
    }
    const row = await insertMember({
      fullName: kid.name.trim(),
      gender: kid.gender,
      isAlive: kid.alive,
      birthOrder: kid.birthOrder,
      fatherId: fatherLinkId,
      motherId,
      notes: form.notes || null,
      currentLocation: childLocation,
      isApproved: true,
      approvedBy: submittedByUser,
      ...submitMeta,
    });
    nextChildIds.push(row.id);
  }

  for (const removedId of memberIds.childIds.filter((id) => !nextChildIds.includes(id))) {
    await db.delete(familyMembers).where(eq(familyMembers.id, removedId));
  }
  memberIds.childIds = nextChildIds;

  return memberIds;
}

export const updateFamilySubmissionFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().min(1),
      form: submitPayloadSchema,
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();

    if (data.id.startsWith("legacy-")) {
      const ids = data.id.replace("legacy-", "").split("-").map(Number).filter(Boolean);
      const rows = await db.select().from(familyMembers).where(inArray(familyMembers.id, ids));
      const children = rows.filter((r) => r.fatherId != null);
      const childIdSet = new Set(children.map((c) => c.id));
      const fatherLinkId = children[0]?.fatherId ?? null;
      const fatherRow =
        rows.find((r) => r.id === fatherLinkId) ??
        rows.find((r) => r.gender === "male" && !childIdSet.has(r.id));
      const motherRows = rows.filter(
        (r) => r.gender === "female" && r.id !== fatherRow?.id && !childIdSet.has(r.id),
      );
      const memberIds: SubmissionMemberIds = {
        fatherId: fatherRow && !fatherRow.isApproved ? fatherRow.id : null,
        motherIds: motherRows.filter((r) => !r.isApproved).map((r) => r.id),
        childIds: children.filter((r) => !r.isApproved).map((r) => r.id),
      };
      await syncSubmissionMembers("legacy", data.form, memberIds, rows[0]?.submittedByUser ?? null);
      return { ok: true };
    }

    const [sub] = await db
      .select()
      .from(familySubmissions)
      .where(eq(familySubmissions.id, data.id))
      .limit(1);
    if (!sub || sub.status !== "pending") throw new Error("Submission not found");

    let memberIds = JSON.parse(sub.memberIds) as SubmissionMemberIds;
    memberIds = await syncSubmissionMembers(sub.id, data.form, memberIds, sub.submittedByUser);

    await db
      .update(familySubmissions)
      .set({
        formData: JSON.stringify(data.form),
        memberIds: JSON.stringify(memberIds),
        updatedAt: new Date(),
      })
      .where(eq(familySubmissions.id, data.id));

    return { ok: true };
  });

export const approveFamilySubmissionFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .middleware([requireAdmin])
  .handler(async ({ data, context }) => {
    const db = getDb();

    if (data.id.startsWith("legacy-")) {
      const ids = data.id.replace("legacy-", "").split("-").map(Number).filter(Boolean);
      await db
        .update(familyMembers)
        .set({
          isApproved: true,
          approvedAt: new Date(),
          approvedBy: context.userId,
          updatedAt: new Date(),
        })
        .where(inArray(familyMembers.id, ids));
      return { ok: true };
    }

    const [sub] = await db
      .select()
      .from(familySubmissions)
      .where(eq(familySubmissions.id, data.id))
      .limit(1);
    if (!sub || sub.status !== "pending") throw new Error("Submission not found");

    const memberIds = JSON.parse(sub.memberIds) as SubmissionMemberIds;
    const allIds = [memberIds.fatherId, ...memberIds.motherIds, ...memberIds.childIds].filter(
      (id): id is number => id != null,
    );

    if (allIds.length > 0) {
      await db
        .update(familyMembers)
        .set({
          isApproved: true,
          approvedAt: new Date(),
          approvedBy: context.userId,
          updatedAt: new Date(),
        })
        .where(inArray(familyMembers.id, allIds));

      for (const id of allIds) await recomputeMemberLineage(id);
    }

    await db
      .update(familySubmissions)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(familySubmissions.id, data.id));

    return { ok: true };
  });

export const rejectFamilySubmissionFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();

    if (data.id.startsWith("legacy-")) {
      const ids = data.id.replace("legacy-", "").split("-").map(Number).filter(Boolean);
      if (ids.length) await db.delete(familyMembers).where(inArray(familyMembers.id, ids));
      return { ok: true };
    }

    const [sub] = await db
      .select()
      .from(familySubmissions)
      .where(eq(familySubmissions.id, data.id))
      .limit(1);
    if (!sub || sub.status !== "pending") throw new Error("Submission not found");

    const memberIds = JSON.parse(sub.memberIds) as SubmissionMemberIds;
    const allIds = [memberIds.fatherId, ...memberIds.motherIds, ...memberIds.childIds].filter(
      (id): id is number => id != null,
    );

    if (allIds.length > 0) {
      await db.delete(familyMembers).where(inArray(familyMembers.id, allIds));
    }

    await db
      .update(familySubmissions)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(familySubmissions.id, data.id));

    return { ok: true };
  });

export const getWivesFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = getDb();
    const rows = await db.select().from(memberWives);
    return rows.map((r) => ({ id: r.id, husband_id: r.husbandId, wife_id: r.wifeId }));
  });

export const searchMembersFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ name: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: familyMembers.id,
        full_name: familyMembers.fullName,
        generation_level: familyMembers.generationLevel,
        is_approved: familyMembers.isApproved,
      })
      .from(familyMembers)
      .where(ilike(familyMembers.fullName, `%${data.name}%`))
      .limit(8);
    return rows;
  });

export const submitFamilyFn = createServerFn({ method: "POST" })
  .inputValidator(submitPayloadSchema)
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    await assertSubmitFamilyValid(data);

    const db = getDb();
    const submitter = data.submitter;
    const autoApprove = Boolean(data.autoApprove && context.isAdmin);
    const memberIds: SubmissionMemberIds = { fatherId: null, motherIds: [], childIds: [] };

    const [submission] = await db
      .insert(familySubmissions)
      .values({
        submittedByUser: context.userId,
        formData: JSON.stringify(data),
        memberIds: JSON.stringify(memberIds),
        status: autoApprove ? "approved" : "pending",
      })
      .returning();
    const submissionId = submission.id;

    const namedMothers = data.mothers.filter((m) => m.name.trim());
    const fatherGetsLocation = await parentGetsLocation(data.father);
    const motherGetsLocation = await Promise.all(data.mothers.map((m) => parentGetsLocation(m)));
    const anyKinParent = fatherGetsLocation || motherGetsLocation.some(Boolean);
    const childLocation = anyKinParent ? data.location || null : null;

    async function resolveOrInsertParent(
      parent: z.infer<typeof parentSchema>,
      gender: "male" | "female",
      track: "father" | "mother",
      applyLocation: boolean,
    ) {
      if (parent.existingId) return parent.existingId;
      const trimmed = parent.name.trim();
      if (!trimmed) return null;
      const existing = await findMemberByName(trimmed);
      if (existing) {
        throw new Error(
          `"${trimmed}" already exists — search and select them from the list instead of typing a new name.`,
        );
      }

      let linkFatherId: number | null = null;
      let linkMotherId: number | null = null;
      if (parent.inKin && parent.kinAnchorId && parent.kinSide) {
        if (parent.kinSide === "father") linkFatherId = parent.kinAnchorId;
        else linkMotherId = parent.kinAnchorId;
      }

      const row = await insertMember({
        fullName: trimmed,
        gender,
        isAlive: parent.alive,
        currentLocation: applyLocation ? data.location || null : null,
        submittedBy: submitter.name || null,
        submitterPhone: submitter.phone || null,
        submitterIsAlive: submitter.alive,
        submittedByUser: context.userId,
        fatherId: linkFatherId,
        motherId: linkMotherId,
        submissionId,
        isApproved: autoApprove,
        approvedBy: autoApprove ? context.userId : null,
      });
      if (track === "father") memberIds.fatherId = row.id;
      else memberIds.motherIds.push(row.id);
      return row.id;
    }

    let fatherId: number | null = null;
    if (data.father.name.trim()) {
      fatherId = await resolveOrInsertParent(data.father, "male", "father", fatherGetsLocation);
    }

    const motherIds: number[] = [];
    for (let i = 0; i < data.mothers.length; i++) {
      const m = data.mothers[i];
      if (!m.name.trim()) continue;
      const id = await resolveOrInsertParent(m, "female", "mother", motherGetsLocation[i]);
      if (id) {
        motherIds.push(id);
        if (fatherId) {
          await db
            .insert(memberWives)
            .values({ husbandId: fatherId, wifeId: id })
            .onConflictDoNothing({
              target: [memberWives.husbandId, memberWives.wifeId],
            });
          await recomputeMemberLineage(id);
        }
      }
    }

    const allKids = [...data.children]
      .filter((c) => c.name.trim())
      .sort((a, b) => a.birthOrder - b.birthOrder);

    for (const kid of allKids) {
      const motherId = resolveChildMotherId(motherIds, kid.motherIndex ?? 0);
      const existing = await findMemberByName(kid.name);
      if (existing) {
        throw new Error(
          `"${kid.name.trim()}" already exists — search and select them from the list instead of typing a new name.`,
        );
      }
      const row = await insertMember({
        fullName: kid.name.trim(),
        gender: kid.gender,
        fatherId,
        motherId,
        isAlive: kid.alive,
        birthOrder: kid.birthOrder,
        currentLocation: childLocation,
        submittedBy: submitter.name || null,
        submitterPhone: submitter.phone || null,
        submitterIsAlive: submitter.alive,
        submittedByUser: context.userId,
        notes: data.notes || null,
        submissionId,
        isApproved: autoApprove,
        approvedBy: autoApprove ? context.userId : null,
      });
      memberIds.childIds.push(row.id);
    }

    await db
      .update(familySubmissions)
      .set({
        formData: JSON.stringify(data),
        memberIds: JSON.stringify(memberIds),
        updatedAt: new Date(),
      })
      .where(eq(familySubmissions.id, submissionId));

    if (autoApprove) {
      const allIds = [memberIds.fatherId, ...memberIds.motherIds, ...memberIds.childIds].filter(
        (id): id is number => id != null,
      );
      for (const id of allIds) await recomputeMemberLineage(id);
    } else {
      const approvedRows = await db
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.isApproved, true));
      const approvedMembers = approvedRows.map(toMember);
      const kinJumps = collectKinLinkJumps(data.father, namedMothers, approvedMembers);
      const jumpNote =
        kinJumps.length > 0 ? ` Lineage gap: ${formatKinLinkJumpsSummary(kinJumps)}.` : "";
      await createAdminAlert({
        title: kinJumps.length > 0 ? "New family submission (lineage gap)" : "New family submission",
        body: `Submitted by ${submitter.name || "Unknown"} — pending approval.${jumpNote}`,
        type: "approval",
        url: "/admin?view=approval",
      });
    }

    return { ok: true, submissionId, autoApproved: autoApprove };
  });

export const approveMemberFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .middleware([requireAdmin])
  .handler(async ({ data, context }) => {
    const db = getDb();
    await db
      .update(familyMembers)
      .set({
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: context.userId,
        updatedAt: new Date(),
      })
      .where(eq(familyMembers.id, data.id));
    await recomputeMemberLineage(data.id);
    return { ok: true };
  });

export const rejectMemberFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    await db.delete(familyMembers).where(eq(familyMembers.id, data.id));
    return { ok: true };
  });

export const deleteMemberFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    await db.delete(familyMembers).where(eq(familyMembers.id, data.id));
    return { ok: true };
  });

export const updateMemberAliveFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number(), isAlive: z.boolean() }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const member = await getMemberById(data.id);
    if (!member) throw new Error("Member not found");
    if (member.isRoot) throw new Error("Cannot change alive status of the root ancestor");

    const db = getDb();
    await db
      .update(familyMembers)
      .set({ isAlive: data.isAlive, updatedAt: new Date() })
      .where(eq(familyMembers.id, data.id));
    return { ok: true };
  });

export const uploadMemberPhotoFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      memberId: z.number(),
      fileBase64: z.string().min(1),
      mimeType: z.string().min(1),
    }),
  )
  .middleware([optionalAuth])
  .handler(async ({ data, context }) => {
    if (!context.isAuthenticated || !context.userId) throw new Error("Unauthorized");

    const member = await getMemberById(data.memberId);
    if (!member) throw new Error("Member not found");

    if (!context.isAdmin) {
      const [user] = await getDb()
        .select({ fullName: users.fullName, memberId: users.memberId })
        .from(users)
        .where(eq(users.id, context.userId))
        .limit(1);
      const ownsMember = user?.memberId ? user.memberId === member.id : user?.fullName === member.fullName;
      if (!ownsMember) {
        throw new Error("You can only update your own profile photo");
      }
    }

    const filename = await saveMemberPhoto(data.fileBase64, data.mimeType);
    await getDb()
      .update(familyMembers)
      .set({ photoUrl: filename, updatedAt: new Date() })
      .where(eq(familyMembers.id, data.memberId));

    return { filename, url: `/uploads/${filename}` };
  });

export const removeMemberPhotoFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ memberId: z.number() }))
  .middleware([optionalAuth])
  .handler(async ({ data, context }) => {
    if (!context.isAuthenticated || !context.userId) throw new Error("Unauthorized");

    const member = await getMemberById(data.memberId);
    if (!member) throw new Error("Member not found");

    if (!context.isAdmin) {
      const [user] = await getDb()
        .select({ fullName: users.fullName, memberId: users.memberId })
        .from(users)
        .where(eq(users.id, context.userId))
        .limit(1);
      const ownsMember = user?.memberId ? user.memberId === member.id : user?.fullName === member.fullName;
      if (!ownsMember) {
        throw new Error("You can only update your own profile photo");
      }
    }

    await getDb()
      .update(familyMembers)
      .set({ photoUrl: null, updatedAt: new Date() })
      .where(eq(familyMembers.id, data.memberId));

    return { ok: true };
  });

export const updateApprovedFamilyFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      form: submitPayloadSchema,
      memberIds: z.object({
        fatherId: z.number().nullable(),
        motherIds: z.array(z.number()),
        childIds: z.array(z.number()),
      }),
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data, context }) => {
    await syncApprovedFamilyMembers(data.form, data.memberIds, context.userId);
    return { ok: true };
  });

export const getAppSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = getDb();
    const rows = await db.select().from(appSettings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });
