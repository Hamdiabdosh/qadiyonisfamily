import { sortMembersByBirthOrder, type Member } from "@/lib/family";
import type { WifeLink } from "@/lib/admin-family-units";

export type TreeLayoutOptions = {
  nodeWidth: number;
  hGap: number;
  coupleGap: number;
  vGap: number;
  familyGap: number;
};

const DEFAULT_OPTIONS: TreeLayoutOptions = {
  nodeWidth: 140,
  hGap: 28,
  coupleGap: 14,
  vGap: 108,
  familyGap: 56,
};

export type TreeLayoutResult = {
  positions: Map<number, { x: number; y: number }>;
};

type LayoutCtx = {
  byId: Map<number, Member>;
  wivesByHusband: Map<number, number[]>;
  childrenByFather: Map<number, Member[]>;
  positions: Map<number, { x: number; y: number }>;
  placed: Set<number>;
  opts: TreeLayoutOptions;
};

function getWives(ctx: LayoutCtx, husbandId: number): Member[] {
  return sortMembersByBirthOrder(
    (ctx.wivesByHusband.get(husbandId) ?? [])
      .map((id) => ctx.byId.get(id))
      .filter((m): m is Member => !!m),
  );
}

function getChildren(ctx: LayoutCtx, fatherId: number): Member[] {
  return sortMembersByBirthOrder(ctx.childrenByFather.get(fatherId) ?? []);
}

function hasFamily(ctx: LayoutCtx, id: number): boolean {
  return (ctx.wivesByHusband.get(id)?.length ?? 0) > 0 || (ctx.childrenByFather.get(id)?.length ?? 0) > 0;
}

function rowWidth(ctx: LayoutCtx, count: number): number {
  if (count <= 0) return 0;
  return count * ctx.opts.nodeWidth + (count - 1) * ctx.opts.hGap;
}

function coupleWidth(ctx: LayoutCtx, husbandId: number): number {
  const wives = getWives(ctx, husbandId);
  if (wives.length === 0) return ctx.opts.nodeWidth;
  return ctx.opts.nodeWidth + wives.length * (ctx.opts.nodeWidth + ctx.opts.coupleGap);
}

function placeAt(ctx: LayoutCtx, id: number, x: number, y: number) {
  if (ctx.placed.has(id)) return;
  ctx.positions.set(id, { x, y });
  ctx.placed.add(id);
}

/** Husband first, then wives — same row for non-root couples. */
function placeCoupleRow(ctx: LayoutCtx, husbandId: number, centerX: number, y: number) {
  const wives = getWives(ctx, husbandId);
  const totalW = coupleWidth(ctx, husbandId);
  let x = centerX - totalW / 2 + ctx.opts.nodeWidth / 2;

  placeAt(ctx, husbandId, x, y);
  x += ctx.opts.nodeWidth + (wives.length > 0 ? ctx.opts.coupleGap : 0);

  for (const wife of wives) {
    placeAt(ctx, wife.id, x, y);
    x += ctx.opts.nodeWidth + ctx.opts.coupleGap;
  }
}

function placeSiblingRow(ctx: LayoutCtx, ids: number[], centerX: number, y: number) {
  const unplaced = ids.filter((id) => !ctx.placed.has(id));
  if (unplaced.length === 0) return;
  const w = rowWidth(ctx, unplaced.length);
  let x = centerX - w / 2 + ctx.opts.nodeWidth / 2;
  for (const id of unplaced) {
    placeAt(ctx, id, x, y);
    x += ctx.opts.nodeWidth + ctx.opts.hGap;
  }
}

/** Width of the whole subtree rooted at this father (or root). */
function measureSubtree(ctx: LayoutCtx, fatherId: number, isRoot: boolean): number {
  const children = getChildren(ctx, fatherId);

  if (isRoot) {
    const wifeW = rowWidth(ctx, getWives(ctx, fatherId).length);
    const topW = Math.max(ctx.opts.nodeWidth, wifeW);
    if (children.length === 0) return topW;
    return Math.max(topW, measureChildrenBand(ctx, children));
  }

  const coupleW = coupleWidth(ctx, fatherId);
  if (children.length === 0) return coupleW;
  return Math.max(coupleW, measureChildrenBand(ctx, children));
}

function measureChildrenBand(ctx: LayoutCtx, children: Member[]): number {
  const widths = children.map((child) =>
    child.gender === "male" && hasFamily(ctx, child.id)
      ? measureSubtree(ctx, child.id, false)
      : ctx.opts.nodeWidth,
  );
  if (widths.length === 0) return 0;
  return widths.reduce((sum, w) => sum + w, 0) + (widths.length - 1) * ctx.opts.familyGap;
}

/** Lay out children of a father; returns bottom Y. */
function layoutChildrenBand(ctx: LayoutCtx, fatherId: number, centerX: number, y: number): number {
  const children = getChildren(ctx, fatherId);
  if (children.length === 0) return y;

  const bandWidth = measureChildrenBand(ctx, children);
  let cursorX = centerX - bandWidth / 2;
  let bottomY = y;

  for (const child of children) {
    if (child.gender === "male" && hasFamily(ctx, child.id)) {
      const sw = measureSubtree(ctx, child.id, false);
      const childCenter = cursorX + sw / 2;
      bottomY = Math.max(bottomY, layoutMaleFamily(ctx, child.id, childCenter, y, false));
      cursorX += sw + ctx.opts.familyGap;
    } else {
      placeAt(ctx, child.id, cursorX + ctx.opts.nodeWidth / 2, y);
      cursorX += ctx.opts.nodeWidth + ctx.opts.familyGap;
      bottomY = Math.max(bottomY, y);
    }
  }

  return bottomY + ctx.opts.vGap;
}

/** Lay out a male's family block (couple row + descendants). Returns bottom Y. */
function layoutMaleFamily(
  ctx: LayoutCtx,
  fatherId: number,
  centerX: number,
  y: number,
  isRoot: boolean,
): number {
  const husband = ctx.byId.get(fatherId);
  if (!husband) return y;

  if (isRoot) {
    placeAt(ctx, fatherId, centerX, y);

    const wives = getWives(ctx, fatherId);
    let nextY = y + ctx.opts.vGap;
    if (wives.length > 0) {
      placeSiblingRow(
        ctx,
        wives.map((w) => w.id),
        centerX,
        nextY,
      );
      nextY += ctx.opts.vGap;
    }

    const children = getChildren(ctx, fatherId);
    if (children.length === 0) return nextY;
    return layoutChildrenBand(ctx, fatherId, centerX, nextY);
  }

  placeCoupleRow(ctx, fatherId, centerX, y);
  const children = getChildren(ctx, fatherId);
  if (children.length === 0) return y + ctx.opts.vGap;
  return layoutChildrenBand(ctx, fatherId, centerX, y + ctx.opts.vGap);
}

function layoutOrphans(ctx: LayoutCtx) {
  const unplaced = [...ctx.byId.values()].filter((m) => !ctx.placed.has(m.id));
  if (unplaced.length === 0) return;

  const byGen = new Map<number, Member[]>();
  for (const m of unplaced) {
    const g = m.generation_level || 1;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(m);
  }

  const maxY =
    ctx.positions.size > 0
      ? Math.max(...[...ctx.positions.values()].map((p) => p.y)) + ctx.opts.vGap * 1.5
      : 0;

  const sortedGens = [...byGen.keys()].sort((a, b) => a - b);
  sortedGens.forEach((g, gi) => {
    const list = sortMembersByBirthOrder(byGen.get(g)!);
    const ids = list.map((m) => m.id);
    const y = maxY + gi * ctx.opts.vGap;
    const w = rowWidth(ctx, ids.length);
    const startX = -w / 2 + ctx.opts.nodeWidth / 2;
    let x = startX;
    for (const id of ids) {
      placeAt(ctx, id, x, y);
      x += ctx.opts.nodeWidth + ctx.opts.hGap;
    }
  });
}

function normalizePositions(ctx: LayoutCtx) {
  if (ctx.positions.size === 0) return;
  const xs = [...ctx.positions.values()].map((p) => p.x);
  const minX = Math.min(...xs);
  const pad = ctx.opts.nodeWidth / 2;
  const shiftX = minX < pad ? pad - minX : 0;
  if (shiftX === 0) return;
  for (const [id, pos] of ctx.positions) {
    ctx.positions.set(id, { x: pos.x + shiftX, y: pos.y });
  }
}

export function computeFamilyTreeLayout(
  members: Member[],
  wives: WifeLink[],
  partialOpts: Partial<TreeLayoutOptions> = {},
): TreeLayoutResult {
  const opts = { ...DEFAULT_OPTIONS, ...partialOpts };
  const byId = new Map(members.map((m) => [m.id, m]));

  const wivesByHusband = new Map<number, number[]>();
  for (const w of wives) {
    if (!byId.has(w.husband_id) || !byId.has(w.wife_id)) continue;
    if (!wivesByHusband.has(w.husband_id)) wivesByHusband.set(w.husband_id, []);
    wivesByHusband.get(w.husband_id)!.push(w.wife_id);
  }

  const childrenByFather = new Map<number, Member[]>();
  for (const m of members) {
    if (!m.father_id || !byId.has(m.father_id)) continue;
    if (!childrenByFather.has(m.father_id)) childrenByFather.set(m.father_id, []);
    childrenByFather.get(m.father_id)!.push(m);
  }

  const ctx: LayoutCtx = {
    byId,
    wivesByHusband,
    childrenByFather,
    positions: new Map(),
    placed: new Set(),
    opts,
  };

  const root = members.find((m) => m.is_root);
  if (root) {
    const totalW = measureSubtree(ctx, root.id, true);
    layoutMaleFamily(ctx, root.id, totalW / 2, 0, true);
  }

  layoutOrphans(ctx);
  normalizePositions(ctx);

  return { positions: ctx.positions };
}
