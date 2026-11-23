/**
 * A goal's mark on the overview map and list (addendum A3 §6): its preset icon, or up to two
 * initials from its title when it has none (or an unknown one).
 */

const SMALL_WORDS = new Set(['a', 'an', 'the', 'in', 'of', 'to', 'and', 'at', 'for', 'my', 'on', 'with', 'by']);

/**
 * Up to two initials: the first and last meaningful words ("Get in better shape" → "GS",
 * "Read more" → "RM", "Cooking" → "C"). Empty when the title has no letters or digits.
 */
export function goalInitials(title: string): string {
  const words = title
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  const meaningful = words.filter((w) => !SMALL_WORDS.has(w.toLowerCase()));
  const use = meaningful.length ? meaningful : words;
  if (!use.length) return '';
  const first = [...use[0]][0];
  const last = use.length > 1 ? [...use[use.length - 1]][0] : '';
  return (first + last).toLocaleUpperCase();
}
