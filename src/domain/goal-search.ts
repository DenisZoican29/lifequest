import type { Goal } from './types';

/** Lower case without accents, so "cafe" finds "Café". */
export const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Goals whose title contains every word of `query` (any order, case- and accent-insensitive).
 * Titles that start with the query come first; otherwise the original order is kept.
 */
export function searchGoals<G extends Pick<Goal, 'title'>>(goals: readonly G[], query: string): G[] {
  const q = fold(query);
  if (!q) return [...goals];
  const words = q.split(/\s+/);
  const hits = goals.filter((g) => {
    const title = fold(g.title);
    return words.every((w) => title.includes(w));
  });
  const starts = hits.filter((g) => fold(g.title).startsWith(q));
  return [...starts, ...hits.filter((g) => !starts.includes(g))];
}

/** True when `text` contains every word of `query` (any order, case- and accent-insensitive). */
export function matchesAll(text: string, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  const t = fold(text);
  return q.split(/\s+/).every((w) => t.includes(w));
}
