import { eq } from "drizzle-orm";

import { getDb } from "@/db/index.server";
import { familyMembers, memberWives } from "@/db/schema";
import { toMember } from "@/lib/db-mapper";
import { buildMap } from "@/lib/lineage";
import {
  computeLineageFields,
  resolveGenerationLevel,
  type WifeLink,
} from "@/lib/lineage-compute.server";

type DbMember = typeof familyMembers.$inferSelect;

function lineageForRow(
  member: DbMember,
  byId: Map<number, DbMember>,
): ReturnType<typeof computeLineageFields> {
  const father = member.fatherId ? byId.get(member.fatherId) : null;
  const mother = member.motherId ? byId.get(member.motherId) : null;
  return computeLineageFields(
    member.fullName,
    member.isRoot,
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
}

async function loadRecomputeContext() {
  const db = getDb();
  const [rows, wifeRows] = await Promise.all([
    db.select().from(familyMembers),
    db.select().from(memberWives),
  ]);
  const dbById = new Map(rows.map((r) => [r.id, r]));
  const members = rows.map(toMember);
  const memberById = buildMap(members);
  const wives: WifeLink[] = wifeRows.map((r) => ({
    husband_id: r.husbandId,
    wife_id: r.wifeId,
  }));
  return { db, rows, dbById, memberById, wives };
}

export async function recomputeMemberLineage(memberId: number) {
  const { db, rows, dbById, memberById, wives } = await loadRecomputeContext();
  const member = dbById.get(memberId);
  if (!member) return;

  const lineage = lineageForRow(member, dbById);
  const generationLevel = resolveGenerationLevel(memberId, lineage.generationLevel, memberById, wives);

  await db
    .update(familyMembers)
    .set({
      generationLevel,
      isInKin: lineage.isInKin,
      lineagePathFather: lineage.lineagePathFather,
      lineagePathMother: lineage.lineagePathMother,
      updatedAt: new Date(),
    })
    .where(eq(familyMembers.id, memberId));
}

/** Two passes so marriage-inherited generations settle after spouses are updated. */
export async function recomputeAllMemberLineage() {
  for (let pass = 0; pass < 2; pass++) {
    const { db, rows, dbById, memberById, wives } = await loadRecomputeContext();
    const updates: Array<{
      id: number;
      generationLevel: number;
      isInKin: boolean;
      lineagePathFather: string;
      lineagePathMother: string;
    }> = [];

    for (const member of rows) {
      const lineage = lineageForRow(member, dbById);
      const generationLevel = resolveGenerationLevel(
        member.id,
        lineage.generationLevel,
        memberById,
        wives,
      );
      updates.push({
        id: member.id,
        generationLevel,
        isInKin: lineage.isInKin,
        lineagePathFather: lineage.lineagePathFather,
        lineagePathMother: lineage.lineagePathMother,
      });
    }

    const now = new Date();
    for (const row of updates) {
      await db
        .update(familyMembers)
        .set({
          generationLevel: row.generationLevel,
          isInKin: row.isInKin,
          lineagePathFather: row.lineagePathFather,
          lineagePathMother: row.lineagePathMother,
          updatedAt: now,
        })
        .where(eq(familyMembers.id, row.id));
    }
  }
}
