import { describe, expect, it } from 'vitest';

import { apportion, buildTerritories, HEX_DIRS, hexCenter, islandCells, placeMarkers, type TerritoryCell } from '../src/domain/territory-map';

const key = (c: { q: number; r: number }) => `${c.q},${c.r}`;

/** Number of connected pieces each territory is split into. */
function pieces(cells: TerritoryCell[], owner: number): number {
  const mine = new Map(cells.filter((c) => c.owner === owner).map((c) => [key(c), c]));
  const seen = new Set<string>();
  let n = 0;
  for (const [k] of mine) {
    if (seen.has(k)) continue;
    n++;
    const queue = [k];
    seen.add(k);
    while (queue.length) {
      const c = mine.get(queue.pop()!)!;
      for (const d of HEX_DIRS) {
        const nk = key({ q: c.q + d.q, r: c.r + d.r });
        if (mine.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          queue.push(nk);
        }
      }
    }
  }
  return n;
}

/** ASCII view for debugging: `npx vitest run territory -t ascii`. */
function ascii(cells: TerritoryCell[]): string {
  const rows = new Map<number, TerritoryCell[]>();
  for (const c of cells) rows.set(c.r, [...(rows.get(c.r) ?? []), c]);
  return [...rows.keys()]
    .sort((a, b) => a - b)
    .map((r) => {
      const row = rows.get(r)!.sort((a, b) => a.q - b.q);
      const minX = Math.min(...cells.map((c) => 2 * c.q + c.r));
      let line = '';
      for (const c of row) {
        const x = 2 * c.q + c.r - minX;
        line = line.padEnd(x, ' ') + (c.owner < 0 ? '.' : String.fromCharCode(65 + c.owner));
      }
      return line;
    })
    .join('\n');
}

describe('territory map', () => {
  it('apportions cells by share, every goal with effort keeps at least one', () => {
    expect(apportion([50, 30, 20], 10)).toEqual([5, 3, 2]);
    expect(apportion([100, 1], 10)).toEqual([9, 1]);
    expect(apportion([0, 0], 10)).toEqual([0, 0]);
    expect(apportion([31, 30, 15, 6, 4, 4, 4, 0], 80).reduce((a, b) => a + b, 0)).toBe(80);
  });

  it.each([
    [[31, 30, 15, 6, 4, 4, 4]],
    [[50, 50]],
    [[1, 1, 1, 1, 1, 1, 1, 1, 1]],
    [[90, 5, 3, 1, 1]],
    [[10]],
    [[3, 0, 7, 2]],
  ])('every territory is one connected piece of the right size (%j)', (weights) => {
    const cells = islandCells();
    const map = buildTerritories(weights, cells);
    const expected = apportion(weights, cells.length);
    expect(map.counts).toEqual(expected);
    expect(map.cells.filter((c) => c.owner < 0)).toHaveLength(0);
    weights.forEach((w, i) => {
      if (w > 0) {
        expect(pieces(map.cells, i)).toBe(1);
        expect(map.labelAt[i]).toBeDefined();
      } else expect(map.labelAt[i]).toBeUndefined();
    });
  });

  it('nothing done leaves the island unclaimed', () => {
    const map = buildTerritories([0, 0, 0]);
    expect(map.cells.every((c) => c.owner === -1)).toBe(true);
  });

  it('is deterministic', () => {
    expect(buildTerritories([5, 3, 2])).toEqual(buildTerritories([5, 3, 2]));
  });

  it('ascii', () => {
    console.log(`\n${ascii(buildTerritories([31, 30, 15, 6, 4, 4, 4]).cells)}\n`);
    console.log(`\n${ascii(buildTerritories([50, 30, 20]).cells)}\n`);
  });

  it.each([320, 390, 430])('markers are 44-point targets that never overlap or leave the map (%i wide)', (cardWidth) => {
    const width = cardWidth - 2 * 16 - 2 * 24; // screen gutters and card padding
    const weights = [31, 30, 15, 6, 4, 4, 4];
    const map = buildTerritories(weights);
    const pts0 = map.cells.map((c) => ({ owner: c.owner, ...hexCenter(c, 1) }));
    const minX = Math.min(...pts0.map((p) => p.x)) - Math.sqrt(3) / 2;
    const minY = Math.min(...pts0.map((p) => p.y)) - 1;
    const unitW = Math.max(...pts0.map((p) => p.x)) + Math.sqrt(3) / 2 - minX;
    const unitH = Math.max(...pts0.map((p) => p.y)) + 1 - minY;
    const size = width / unitW;
    const pts = pts0.map((p) => ({ owner: p.owner, x: (p.x - minX) * size, y: (p.y - minY) * size }));
    const markers = placeMarkers(pts, map.counts, 44, width, unitH * size);
    expect(markers.length).toBeGreaterThanOrEqual(2);
    expect(new Set(markers.map((m) => m.owner)).size).toBe(markers.length);
    for (const m of markers) {
      expect(m.x - 22).toBeGreaterThanOrEqual(0);
      expect(m.x + 22).toBeLessThanOrEqual(width);
      expect(map.cells.some((c) => c.owner === m.owner)).toBe(true);
      for (const o of markers) if (o !== m) expect(Math.abs(o.x - m.x) >= 44 || Math.abs(o.y - m.y) >= 44).toBe(true);
    }
    // The largest territory always gets its marker.
    expect(markers[0].owner).toBe(0);
  });

  it.each([320, 390])('map pins (44 x 56 with their label) fit inside the map and never overlap (%i wide)', (cardWidth) => {
    const width = cardWidth - 2 * 16 - 2 * 16; // screen gutters and card padding
    const map = buildTerritories([31, 30, 15, 6, 4, 4, 4]);
    const pts0 = map.cells.map((c) => ({ owner: c.owner, ...hexCenter(c, 1) }));
    const minX = Math.min(...pts0.map((p) => p.x)) - Math.sqrt(3) / 2;
    const minY = Math.min(...pts0.map((p) => p.y)) - 1;
    const unitW = Math.max(...pts0.map((p) => p.x)) + Math.sqrt(3) / 2 - minX;
    const unitH = Math.max(...pts0.map((p) => p.y)) + 1 - minY;
    const size = width / unitW;
    const height = unitH * size;
    const pts = pts0.map((p) => ({ owner: p.owner, x: (p.x - minX) * size, y: (p.y - minY) * size }));
    const pins = placeMarkers(pts, map.counts, 44, width, height, 56);
    expect(pins[0].owner).toBe(0);
    for (const m of pins) {
      expect(m.y - 28).toBeGreaterThanOrEqual(0);
      expect(m.y + 28).toBeLessThanOrEqual(height);
      for (const o of pins) if (o !== m) expect(Math.abs(o.x - m.x) >= 44 || Math.abs(o.y - m.y) >= 56).toBe(true);
    }
  });
});
