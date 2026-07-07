import type { familyMembers } from "@/db/schema";
import type { Member } from "@/lib/family";

type FamilyMemberRow = typeof familyMembers.$inferSelect;

export function toMember(row: FamilyMemberRow): Member {
  return {
    id: row.id,
    full_name: row.fullName,
    gender: row.gender,
    father_id: row.fatherId,
    mother_id: row.motherId,
    generation_level: row.generationLevel,
    is_in_kin: row.isInKin,
    lineage_path_father: row.lineagePathFather,
    lineage_path_mother: row.lineagePathMother,
    is_alive: row.isAlive,
    birth_year: row.birthYear,
    birth_order: row.birthOrder,
    death_year: row.deathYear,
    current_location: row.currentLocation,
    photo_url: row.photoUrl,
    submitted_by: row.submittedBy,
    submitter_phone: row.submitterPhone,
    submitter_is_alive: row.submitterIsAlive,
    submitted_by_user: row.submittedByUser,
    notes: row.notes,
    is_approved: row.isApproved,
    approved_by: row.approvedBy,
    approved_at: row.approvedAt?.toISOString() ?? null,
    is_root: row.isRoot,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
