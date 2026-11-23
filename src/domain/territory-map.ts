/**
 * Goals overview map (addendum A3 §4.3): a hexagon island split into one connected territory
 * per goal, sized by its share. Pure and deterministic: the same shares draw the same map.
 *
 * Cells use axial coordinates (q, r) for pointy-top hexagons.
 */

export interface Hex {
  q: number;
  r: number;
}

export interface TerritoryCell extends Hex {
  /** Index into the `sizes` passed to `buildTerritories`, or -1 for unclaimed land. */
  owner: number;
}

export interface TerritoryMap {
  cells: TerritoryCell[];
  /** Per territory: the cell nearest its middle, for the label; undefined when it holds no cells. */
  labelAt: (Hex | undefined)[];
  /** Cells per territory. */
  counts: number[];
}

/** Neighbour offsets, in edge order E, SE, SW, W, NW, NE (matches `hexCorners` edges i → i+1). */
export const HEX_DIRS: Hex[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

const key = (h: Hex) => `${h.q},${h.r}`;
const ring = (h: Hex) => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r));
/** Screen position for unit size (pointy-top). */
export const hexCenter = (h: Hex, size: number) => ({ x: size * Math.sqrt(3) * (h.q + h.r / 2), y: size * 1.5 * h.r });

/**
 * The island: a hexagonal disc of `radius` with a ragged coast (some outer-ring cells dropped
 * in a fixed pattern), so it reads as land rather than a perfect hexagon.
 */
export function islandCells(radius = 5): Hex[] {
  const out: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const h = { q, r };
      const d = ring(h);
      if (d > radius) continue;
      // Drop the six sharp corners and every third coast cell.
      if (d === radius && (Math.abs(q) === radius || Math.abs(r) === radius || Math.abs(q + r) === radius)) {
        const corner = [Math.abs(q), Math.abs(r), Math.abs(q + r)].filter((x) => x === radius).length === 2;
        if (corner || (((q * 7 + r * 13) % 3) + 3) % 3 === 0) continue;
      }
      out.push(h);
    }
  }
  return out;
}

/** Whole cell counts proportional to `weights` that sum to `total`; every positive weight gets at least one. */
export function apportion(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const counts = raw.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  const byRemainder = raw.map((_, i) => i).sort((a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a])) || a - b);
  for (const i of byRemainder) {
    if (left <= 0) break;
    if (weights[i] > 0) {
      counts[i]++;
      left--;
    }
  }
  // Every goal with effort keeps a foothold, taken from the largest territory.
  for (let i = 0; i < counts.length; i++) {
    if (weights[i] > 0 && counts[i] === 0) {
      const big = counts.indexOf(Math.max(...counts));
      counts[big]--;
      counts[i]++;
    }
  }
  return counts;
}

/** Is this set of cells one connected piece? */
function connected(cells: Hex[]): boolean {
  if (cells.length <= 1) return true;
  const set = new Set(cells.map(key));
  const seen = new Set([key(cells[0])]);
  const queue = [cells[0]];
  while (queue.length) {
    const c = queue.pop()!;
    for (const d of HEX_DIRS) {
      const n = { q: c.q + d.q, r: c.r + d.r };
      const k = key(n);
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return seen.size === cells.length;
}

/** The three hex axes (and a little tilt either way) to cut along. */
const CUT_ANGLES = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6];

/**
 * Splits the island like a treemap: the goals are split into two groups of near-equal size, the
 * land is cut in a straight line across its longest side in that ratio, and each side is split
 * again. Sizes come out exact, territories stay compact, and every cut is checked to leave both
 * sides in one piece.
 */
export function buildTerritories(weights: number[], cells: Hex[] = islandCells()): TerritoryMap {
  const counts = apportion(weights, cells.length);
  const owner = new Map<string, number>();
  const items = counts
    .map((n, i) => ({ n, i }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i);

  const split = (land: Hex[], group: { n: number; i: number }[]) => {
    if (!group.length) return;
    if (group.length === 1) {
      for (const c of land) owner.set(key(c), group[0].i);
      return;
    }
    // Two groups, as balanced as possible, keeping the size order (largest first).
    const total = group.reduce((a, x) => a + x.n, 0);
    let cut = 1;
    let acc = group[0].n;
    let best = Math.abs(total - 2 * acc);
    for (let k = 2, run = acc; k < group.length; k++) {
      run += group[k - 1].n;
      const diff = Math.abs(total - 2 * run);
      if (diff < best) {
        best = diff;
        cut = k;
        acc = run;
      }
    }
    const left = group.slice(0, cut);
    const right = group.slice(cut);
    const nLeft = left.reduce((a, x) => a + x.n, 0);

    // Cut across the longest extent first; fall back to other angles if a side would break apart.
    const pts = land.map((c) => ({ c, p: hexCenter(c, 1) }));
    const extent = (a: number) => {
      const proj = pts.map(({ p }) => p.x * Math.cos(a) + p.y * Math.sin(a));
      return Math.max(...proj) - Math.min(...proj);
    };
    const angles = [...CUT_ANGLES].sort((a, b) => extent(b) - extent(a));
    let chosen: [Hex[], Hex[]] | undefined;
    for (const a of angles) {
      const sorted = [...pts]
        .map(({ c, p }) => ({ c, s: p.x * Math.cos(a) + p.y * Math.sin(a), t: -p.x * Math.sin(a) + p.y * Math.cos(a) }))
        .sort((x, y) => x.s - y.s || x.t - y.t)
        .map((x) => x.c);
      const tryCut: [Hex[], Hex[]] = [sorted.slice(0, nLeft), sorted.slice(nLeft)];
      if (connected(tryCut[0]) && connected(tryCut[1])) {
        chosen = tryCut;
        break;
      }
      chosen ??= tryCut;
    }
    split(chosen![0], left);
    split(chosen![1], right);
  };
  split(cells, items);

  const out = cells.map((c) => ({ ...c, owner: owner.get(key(c)) ?? -1 }));
  const labelAt = counts.map((_, id) => {
    const own = out.filter((c) => c.owner === id);
    if (!own.length) return undefined;
    const pts = own.map((c) => hexCenter(c, 1));
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    // Prefer an inland cell (all neighbours its own) near the middle.
    const inland = (c: Hex) => HEX_DIRS.filter((d) => owner.get(key({ q: c.q + d.q, r: c.r + d.r })) === id).length;
    return own
      .map((c, i) => ({ c, d: (pts[i].x - mx) ** 2 + (pts[i].y - my) ** 2 - inland(c) * 0.4 }))
      .sort((a, b) => a.d - b.d)[0].c;
  });
  return { cells: out, labelAt, counts: counts.map((_, id) => out.filter((c) => c.owner === id).length) };
}

export interface MarkerSpot {
  owner: number;
  x: number;
  y: number;
}

/**
 * Marker positions (addendum A3 §6, §8): at most one per territory, largest territory first, each
 * a `box` × `boxH` target (a map pin with its share label is taller than wide) centred on one of
 * its own cells (nearest its middle first), inside the map and never overlapping another.
 * Territories with no such spot get no marker; their cells stay tappable.
 */
export function placeMarkers(
  points: { owner: number; x: number; y: number }[],
  counts: number[],
  box: number,
  width: number,
  height: number,
  boxH = box,
): MarkerSpot[] {
  const half = box / 2;
  const halfH = boxH / 2;
  const out: MarkerSpot[] = [];
  const order = counts
    .map((n, i) => ({ n, i }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i);
  for (const { i } of order) {
    const own = points.filter((pt) => pt.owner === i);
    const mx = own.reduce((a, pt) => a + pt.x, 0) / own.length;
    const my = own.reduce((a, pt) => a + pt.y, 0) / own.length;
    const spot = own
      .slice()
      .sort((a, b) => (a.x - mx) ** 2 + (a.y - my) ** 2 - ((b.x - mx) ** 2 + (b.y - my) ** 2))
      .find(
        (pt) =>
          pt.x - half >= 0 &&
          pt.x + half <= width &&
          pt.y - halfH >= 0 &&
          pt.y + halfH <= height &&
          out.every((m) => Math.abs(m.x - pt.x) >= box || Math.abs(m.y - pt.y) >= boxH),
      );
    if (spot) out.push({ owner: i, x: spot.x, y: spot.y });
  }
  return out;
}
