/**
 * Avoid the Word — answer matching.
 *
 * Pure, dependency-free and unit-testable (`npm run test:avoid`): the server
 * compares a player's answer to the anchor's hidden answer with the rules below,
 * so this module is the single definition of "matched".
 *
 * Text normalisation order: lowercase → strip diacritics (NFKD + mark removal) →
 * remove punctuation → drop a leading article → collapse whitespace → fold a
 * naive trailing plural. Two text answers match when the normalised strings are
 * equal, when one is a stem of the other, or when they are one edit apart and
 * both are at least 5 characters long (typo tolerance).
 */

import { AvoidAnswerType, AvoidQuestion } from '../../shared/types';

/** Longest answer a player may submit. */
export const MAX_ANSWER_WORDS = 3;
export const MAX_ANSWER_CHARS = 30;

/** Shown for a skipped turn (timeout / disconnect). */
export const NO_ANSWER_LABEL = '(no answer)';

/** Typos are only forgiven from this length up, and only one edit apart. */
export const TYPO_MIN_LENGTH = 5;
export const TYPO_MAX_DISTANCE = 1;

/** How many trailing characters a stem match may swallow. */
const STEM_MAX_EXTRA_CHARS = 3;
const STEM_MIN_LENGTH = 4;

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

/** Text answers: trimmed, control characters stripped, max 3 words / 30 chars. */
export function sanitizeTextAnswer(raw: unknown): string {
  const cleaned = cleanAnswerText(raw);
  if (!cleaned) return '';
  return cleaned.split(' ').slice(0, MAX_ANSWER_WORDS).join(' ').slice(0, MAX_ANSWER_CHARS).trim();
}

/** Folds a naive trailing plural: mangoes → mango, pizzas → pizza. */
export function foldPlural(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es') && /(?:s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Lowercase, accent-free, punctuation-free, article-free, plural-folded form.
 * `"The Pizzas!"` and `"pizza"` normalise to the same key.
 */
export function normalizeAnswer(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const stripped = raw
    .normalize('NFKD')
    // Remove combining marks left behind by NFKD (é → e + ́).
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';

  const words = stripped.split(' ');
  while (words.length > 1 && LEADING_ARTICLES.includes(words[0])) words.shift();
  return words.map((word) => (/^[0-9]+$/.test(word) ? word : foldPlural(word))).join(' ');
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

/** True when one normalized answer is a plain stem of the other. */
export function isStemOf(a: string, b: string): boolean {
  if (a === b) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < STEM_MIN_LENGTH) return false;
  if (longer.length - shorter.length > STEM_MAX_EXTRA_CHARS) return false;
  return longer.startsWith(shorter);
}

/** The full text rule: equal, stem, or one typo apart (both long enough). */
export function isTextMatch(a: unknown, b: unknown): boolean {
  const left = normalizeAnswer(a);
  const right = normalizeAnswer(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (isStemOf(left, right)) return true;
  if (left.length >= TYPO_MIN_LENGTH && right.length >= TYPO_MIN_LENGTH) {
    return editDistanceWithin(left, right, TYPO_MAX_DISTANCE) !== null;
  }
  return false;
}

/** Numbers compare by value, so "7" matches "07". */
export function parseNumberAnswer(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * The single matching entry point, dispatched by the round's answer type:
 *  - text   → isTextMatch
 *  - choice → the same option (case/spacing insensitive)
 *  - number → the same numeric value
 *  - player → the same chosen player id
 */
export function isAnswerMatch(
  answerType: AvoidAnswerType,
  answer: unknown,
  target: unknown
): boolean {
  if (answer === null || answer === undefined || target === null || target === undefined) {
    return false;
  }

  switch (answerType) {
    case 'choice':
      return cleanAnswerText(String(answer)).toLowerCase() === cleanAnswerText(String(target)).toLowerCase();
    case 'number': {
      const left = parseNumberAnswer(answer);
      const right = parseNumberAnswer(target);
      return left !== null && right !== null && left === right;
    }
    case 'player':
      return String(answer).trim() === String(target).trim();
    case 'text':
    default:
      return isTextMatch(answer, target);
  }
}

/** Convenience wrapper for a stored question. */
export function answerMatchesQuestion(
  question: Pick<AvoidQuestion, 'answerType'>,
  answer: unknown,
  target: unknown
): boolean {
  return isAnswerMatch(question.answerType, answer, target);
}

/**
 * Canonical key used to spot the same answer twice (bots and analytics): the
 * normalised text, the folded option, the numeric value or the player id.
 */
export function answerKey(answerType: AvoidAnswerType, answer: unknown): string {
  switch (answerType) {
    case 'choice':
      return cleanAnswerText(String(answer)).toLowerCase();
    case 'number': {
      const value = parseNumberAnswer(answer);
      return value === null ? '' : String(value);
    }
    case 'player':
      return String(answer ?? '').trim();
    case 'text':
    default:
      return normalizeAnswer(answer);
  }
}
