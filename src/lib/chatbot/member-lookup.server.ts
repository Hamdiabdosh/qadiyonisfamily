import { and, asc, eq, ilike, or } from "drizzle-orm";

import { getDb } from "@/db/index.server";
import { familyMembers } from "@/db/schema";

export type MemberHit = {
  id: number;
  full_name: string;
  generation_level: number;
  is_in_kin: boolean;
  is_alive: boolean;
  current_location: string | null;
  is_root: boolean;
  gender: string;
};

/** Pull a person name from questions like "who is Qadi Yonis?" */
export function extractPersonQuery(message: string): string | null {
  const q = message.trim();
  const patterns = [
    /^who\s+(?:is|was)\s+(.+?)\??$/i,
    /^tell\s+me\s+about\s+(.+?)\??$/i,
    /^what\s+do\s+you\s+know\s+about\s+(.+?)\??$/i,
    /^about\s+(.+?)\??$/i,
  ];
  for (const pattern of patterns) {
    const match = q.match(pattern);
    const name = match?.[1]?.trim();
    if (name && name.length >= 2) return name;
  }
  return null;
}

export async function searchMembersForChat(query: string): Promise<MemberHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const db = getDb();
  const rows = await db
    .select({
      id: familyMembers.id,
      full_name: familyMembers.fullName,
      generation_level: familyMembers.generationLevel,
      is_in_kin: familyMembers.isInKin,
      is_alive: familyMembers.isAlive,
      current_location: familyMembers.currentLocation,
      is_root: familyMembers.isRoot,
      gender: familyMembers.gender,
    })
    .from(familyMembers)
    .where(and(eq(familyMembers.isApproved, true), ilike(familyMembers.fullName, `%${term}%`)))
    .orderBy(asc(familyMembers.generationLevel), asc(familyMembers.fullName))
    .limit(8);

  if (rows.length > 0) return rows;

  const words = term.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return [];

  const conditions = words.map((w) => ilike(familyMembers.fullName, `%${w}%`));
  return db
    .select({
      id: familyMembers.id,
      full_name: familyMembers.fullName,
      generation_level: familyMembers.generationLevel,
      is_in_kin: familyMembers.isInKin,
      is_alive: familyMembers.isAlive,
      current_location: familyMembers.currentLocation,
      is_root: familyMembers.isRoot,
      gender: familyMembers.gender,
    })
    .from(familyMembers)
    .where(and(eq(familyMembers.isApproved, true), or(...conditions)))
    .orderBy(asc(familyMembers.generationLevel), asc(familyMembers.fullName))
    .limit(8);
}

function formatOne(m: MemberHit): string {
  const parts = [
    `${m.full_name} (member #${m.id})`,
    `generation ${m.generation_level}`,
    m.is_in_kin ? "in-kin" : "out-of-kin",
    m.is_alive ? "alive" : "deceased",
    m.gender,
  ];
  if (m.is_root) parts.push("root ancestor of the lineage");
  if (m.current_location) parts.push(`location: ${m.current_location}`);
  return parts.join(", ");
}

export function formatMembersBlock(members: MemberHit[]): string {
  return members.map((m) => `- ${formatOne(m)}`).join("\n");
}

/** Factual reply from the database when the LLM is unavailable. */
export async function tryMemberLookupReply(message: string): Promise<string | null> {
  const nameQuery = extractPersonQuery(message);
  if (!nameQuery) return null;

  const members = await searchMembersForChat(nameQuery);
  if (members.length === 0) {
    return `I couldn't find an approved member named "${nameQuery}" in the tree. Try Kin Directory or Add Family to register them.`;
  }

  if (members.length === 1) {
    const m = members[0];
    let intro = `${m.full_name} is recorded in the Qadi Yonis family tree`;
    if (m.is_root) intro += " as the root ancestor";
    intro += `. ${formatOne(m)}. Open Tree or Kin Directory for lineage details.`;
    return intro;
  }

  return `I found ${members.length} members matching "${nameQuery}":\n${formatMembersBlock(members)}\n\nOpen Kin Directory to explore each person.`;
}

export async function getMemberContextBlock(message: string): Promise<string> {
  const nameQuery = extractPersonQuery(message);
  if (!nameQuery) return "";

  const members = await searchMembersForChat(nameQuery);
  return members.length > 0 ? formatMembersBlock(members) : "";
}
