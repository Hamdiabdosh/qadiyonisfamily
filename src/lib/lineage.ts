import type { Member } from "./family";

export function buildMap(members: Member[]) {
  const byId = new Map<number, Member>();
  members.forEach((m) => byId.set(m.id, m));
  return byId;
}

export function fatherChain(id: number, byId: Map<number, Member>): Member[] {
  const out: Member[] = [];
  let cur = byId.get(id);
  const seen = new Set<number>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    if (cur.is_root) break;
    cur = cur.father_id ? byId.get(cur.father_id) : undefined;
  }
  return out;
}
export function motherChain(id: number, byId: Map<number, Member>): Member[] {
  const out: Member[] = [];
  let cur = byId.get(id);
  const seen = new Set<number>();
  let first = true;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    if (cur.is_root) break;
    // first hop must be mother, after that follow father side up
    if (first) {
      cur = cur.mother_id ? byId.get(cur.mother_id) : undefined;
      first = false;
    } else {
      cur = cur.father_id ? byId.get(cur.father_id) : (cur.mother_id ? byId.get(cur.mother_id) : undefined);
    }
  }
  return out;
}

export function chainReachesRoot(chain: Member[]) {
  return chain.length > 0 && chain[chain.length - 1].is_root;
}

export function ancestorSet(id: number, byId: Map<number, Member>): Set<number> {
  const out = new Set<number>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    const m = byId.get(cur);
    if (!m) continue;
    if (m.father_id) stack.push(m.father_id);
    if (m.mother_id) stack.push(m.mother_id);
  }
  return out;
}

/** Shortest path between two members through ancestor graph. */
export function shortestRelation(aId: number, bId: number, byId: Map<number, Member>): Member[] | null {
  if (aId === bId) return [byId.get(aId)!];
  const aAnc = ancestorSet(aId, byId);
  // BFS from b up
  const visited = new Map<number, number | null>([[bId, null]]);
  const queue = [bId];
  while (queue.length) {
    const cur = queue.shift()!;
    if (aAnc.has(cur)) {
      // walk back from cur to b, then a→...→cur
      const pathB: number[] = [];
      let n: number | null = cur;
      while (n !== null) { pathB.push(n); n = visited.get(n) ?? null; }
      pathB.reverse(); // [cur,...,b]
      // path from a up to cur
      const pathA: number[] = [];
      let x: number | undefined = aId;
      const seen = new Set<number>();
      while (x !== undefined && x !== cur && !seen.has(x)) {
        seen.add(x); pathA.push(x);
        const m = byId.get(x);
        if (!m) break;
        x = m.father_id ?? m.mother_id ?? undefined;
      }
      if (x === cur) {
        const ids = [...pathA, ...pathB];
        return ids.map((i) => byId.get(i)!).filter(Boolean);
      }
      return null;
    }
    const m = byId.get(cur);
    if (!m) continue;
    for (const next of [m.father_id, m.mother_id]) {
      if (next && !visited.has(next)) { visited.set(next, cur); queue.push(next); }
    }
  }
  return null;
}
