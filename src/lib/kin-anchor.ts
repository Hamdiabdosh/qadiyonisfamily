import type { KinLinkSide, Member } from "./family";
import type { ParentKinInput } from "./parent-kin";
import { buildMap, chainReachesRoot, fatherChain, motherChain } from "./lineage";

function lineChain(id: number, side: KinLinkSide, byId: Map<number, Member>): Member[] {
  return side === "father" ? fatherChain(id, byId) : motherChain(id, byId);
}

/** True when A and B lie on the same kin branch on this line (one is an ancestor of the other). */
export function sameKinBranch(
  aId: number,
  bId: number,
  side: KinLinkSide,
  byId: Map<number, Member>,
): boolean {
  const chainA = lineChain(aId, side, byId);
  const chainB = lineChain(bId, side, byId);
  const idsA = new Set(chainA.map((m) => m.id));
  const idsB = new Set(chainB.map((m) => m.id));
  return chainA.some((m) => idsB.has(m.id)) || chainB.some((m) => idsA.has(m.id));
}

export function nearestKinAnchorOnBranch(
  anchorId: number,
  side: KinLinkSide,
  members: Member[],
): Member | null {
  const byId = buildMap(members);
  const gender = side === "father" ? "male" : "female";
  const pool = members.filter(
    (m) =>
      m.is_approved &&
      m.is_in_kin &&
      m.gender === gender &&
      sameKinBranch(anchorId, m.id, side, byId) &&
      chainReachesRoot(lineChain(m.id, side, byId)),
  );
  if (pool.length === 0) return null;
  return pool.reduce((best, m) => (m.generation_level > best.generation_level ? m : best));
}

/** Someone already registered at anchor.gen + 1 on this kin line and branch. */
export function hasKinChildAtNextGeneration(
  anchorId: number,
  side: KinLinkSide,
  members: Member[],
  byId: Map<number, Member>,
): boolean {
  const anchor = byId.get(anchorId);
  if (!anchor) return false;
  const nextGen = anchor.generation_level + 1;
  const gender = side === "father" ? "male" : "female";
  return members.some(
    (m) =>
      m.is_approved &&
      m.is_in_kin &&
      m.gender === gender &&
      m.generation_level === nextGen &&
      sameKinBranch(anchorId, m.id, side, byId),
  );
}

export type KinLinkJumpKind = "skipped_closer" | "missing_intermediate";

export type KinLinkJump = {
  parentName: string;
  parentRole: "father" | "mother";
  side: KinLinkSide;
  anchorName: string;
  anchorGeneration: number;
  nearestName: string;
  nearestGeneration: number;
  kind: KinLinkJumpKind;
  skippedGenerations: number;
  newParentGeneration: number;
};

export function analyzeKinLinkJump(
  parent: ParentKinInput & { role?: "father" | "mother" },
  members: Member[],
): KinLinkJump | null {
  if (parent.existingId) return null;
  if (!parent.inKin || !parent.kinSide || !parent.kinAnchorId || !parent.name.trim()) return null;

  const byId = buildMap(members);
  const anchor = byId.get(parent.kinAnchorId);
  if (!anchor) return null;

  const chain = lineChain(parent.kinAnchorId, parent.kinSide, byId);
  if (!chainReachesRoot(chain)) return null;

  const nearest = nearestKinAnchorOnBranch(parent.kinAnchorId, parent.kinSide, members);
  if (!nearest) return null;

  const skipped = nearest.generation_level - anchor.generation_level;
  const newParentGen = anchor.generation_level + 1;
  const role = parent.role ?? "father";

  if (skipped > 0) {
    return {
      parentName: parent.name.trim(),
      parentRole: role,
      side: parent.kinSide,
      anchorName: anchor.full_name,
      anchorGeneration: anchor.generation_level,
      nearestName: nearest.full_name,
      nearestGeneration: nearest.generation_level,
      kind: "skipped_closer",
      skippedGenerations: skipped,
      newParentGeneration: newParentGen,
    };
  }

  if (!hasKinChildAtNextGeneration(parent.kinAnchorId, parent.kinSide, members, byId)) {
    return {
      parentName: parent.name.trim(),
      parentRole: role,
      side: parent.kinSide,
      anchorName: anchor.full_name,
      anchorGeneration: anchor.generation_level,
      nearestName: nearest.full_name,
      nearestGeneration: nearest.generation_level,
      kind: "missing_intermediate",
      skippedGenerations: 0,
      newParentGeneration: newParentGen,
    };
  }

  return null;
}

export function collectKinLinkJumps(
  father: ParentKinInput,
  mothers: ParentKinInput[],
  members: Member[],
): KinLinkJump[] {
  const jumps: KinLinkJump[] = [];
  const fatherJump = analyzeKinLinkJump({ ...father, role: "father" }, members);
  if (fatherJump) jumps.push(fatherJump);
  for (const mother of mothers) {
    const jump = analyzeKinLinkJump({ ...mother, role: "mother" }, members);
    if (jump) jumps.push(jump);
  }
  return jumps;
}

export function formatKinLinkJumpAlert(jump: KinLinkJump): string {
  if (jump.kind === "skipped_closer") {
    return `${jump.parentName} (${jump.parentRole}) linked to ${jump.anchorName} (gen ${jump.anchorGeneration}) but nearest on ${jump.side} line is ${jump.nearestName} (gen ${jump.nearestGeneration}) — ${jump.skippedGenerations} generation(s) skipped`;
  }
  return `${jump.parentName} (${jump.parentRole}) linked to nearest relative ${jump.anchorName} (gen ${jump.anchorGeneration}) — generation ${jump.newParentGeneration} not in tree yet on this line`;
}

export function formatKinLinkJumpsSummary(jumps: KinLinkJump[]): string {
  return jumps.map(formatKinLinkJumpAlert).join("; ");
}
