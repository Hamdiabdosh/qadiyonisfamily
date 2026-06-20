import type { KinLinkSide, Member } from "./family";
import { chainReachesRoot, fatherChain, motherChain } from "./lineage";

export type ParentKinInput = {
  name: string;
  existingId: number | null;
  inKin: boolean | null;
  kinSide: KinLinkSide | null;
  kinAnchorId: number | null;
};

/** True when this parent is in the Qadi Yonis family (existing member or valid kin link). */
export function parentLinksToQadiYonis(parent: ParentKinInput, byId: Map<number, Member>): boolean {
  if (!parent.name.trim()) return false;
  if (parent.existingId) {
    return !!byId.get(parent.existingId)?.is_in_kin;
  }
  if (parent.inKin !== true) return false;
  if (!parent.kinSide || !parent.kinAnchorId) return false;
  const chain =
    parent.kinSide === "father"
      ? fatherChain(parent.kinAnchorId, byId)
      : motherChain(parent.kinAnchorId, byId);
  return chainReachesRoot(chain);
}

export function kinParentNamesForLocation(
  father: ParentKinInput,
  mothers: ParentKinInput[],
  byId: Map<number, Member>,
): string[] {
  const names: string[] = [];
  if (parentLinksToQadiYonis(father, byId)) names.push(father.name.trim());
  for (const m of mothers) {
    if (parentLinksToQadiYonis(m, byId)) names.push(m.name.trim());
  }
  return names;
}
