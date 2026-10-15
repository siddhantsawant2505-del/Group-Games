/**
 * Shared text normalisation for the matching games.
 *
 * Avoid the Word and Top 100 both have to answer "did these two strings mean the
 * same thing?", so the primitives live here instead of inside either game:
 * control-character stripping, diacritic removal, punctuation removal, a leading
 * article drop, a naive plural fold and a bounded edit distance.
 *
 * Each game keeps its own `*.match.ts` for what *counts* as a match (typo
 * windows, stem rules, ambiguity). This module only rewrites text, and it is
 * pure, dependency-free and covered by both game suites.
 */

/** Articles that carry no information at the front of an answer. */
const LEADING_ARTICLES = ['a', 'an', 'the'];

/**
 * Strips control characters and collapses whitespace. Used for every answer
 * before it is stored, and again for display: the client renders through React,
 * which escapes text, so no HTML entity encoding is applied here (encoding here
 * would double-escape and show `&amp;` on screen). Angle brackets are dropped so
 * a stored answer can never look like markup.
 */
export function cleanAnswerText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** NFKD-decomposes and drops the combining marks NFKD leaves behind (é → e). */
export function stripDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

/** Folds a naive trailing plural: mangoes → mango, pizzas → pizza. */
export function foldPlural(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es') && /(?:s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export interface NormalizeOptions {
  /** Fold naive trailing plurals (Avoid the Word does, Top 100 does not). */
  foldPlurals?: boolean;
}

/**
 * The shared pipeline: drop a leading "@" → lowercase → strip diacritics →
 * remove punctuation → drop a leading article → collapse whitespace.
 *
 * `normalizeBase('The Pizzas!')` and `normalizeBase('pizza', { foldPlurals: true })`
 * both come out as `pizza` when plural folding is on.
 */
export function normalizeBase(raw: unknown, options: NormalizeOptions = {}): string {
  if (typeof raw !== 'string') return '';

  // A leading "@" is a handle marker, not part of the name ("@nike" → nike).
  const withoutHandle = raw.trim().replace(/^@+/, '');
  const stripped = stripDiacritics(withoutHandle)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';

  const words = stripped.split(' ');
  while (words.length > 1 && LEADING_ARTICLES.includes(words[0])) words.shift();
  return (
    options.foldPlurals
      ? words.map((word) => (/^[0-9]+$/.test(word) ? word : foldPlural(word)))
      : words
  ).join(' ');
}

/**
 * Edit distance, abandoned as soon as it exceeds `max`. Returns null when the
 * two strings are further apart than that.
 */
export function editDistanceWithin(a: string, b: string, max: number): number | null {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return null;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1, // deletion
        current[j - 1] + 1, // insertion
        previous[j - 1] + cost // substitution
      );
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return null;
    previous = current;
  }

  const distance = previous[b.length];
  return distance <= max ? distance : null;
}
