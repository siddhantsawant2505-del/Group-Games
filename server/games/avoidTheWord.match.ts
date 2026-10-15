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
import {
  cleanAnswerText,
  editDistanceWithin,
  foldPlural,
  normalizeBase,
} from './textNormalize';

/**
 * The shared normaliser primitives live in `./textNormalize` so Top 100 can use
 * the same pipeline. They are re-exported here because this module has always
 * been their public entry point for the Avoid the Word engine and its suite.
 */
export { cleanAnswerText, editDistanceWithin, foldPlural };

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

/** Text answers: trimmed, control characters stripped, max 3 words / 30 chars. */
export function sanitizeTextAnswer(raw: unknown): string {
  const cleaned = cleanAnswerText(raw);
  if (!cleaned) return '';
  return cleaned.split(' ').slice(0, MAX_ANSWER_WORDS).join(' ').slice(0, MAX_ANSWER_CHARS).trim();
}

/**
 * Lowercase, accent-free, punctuation-free, article-free, plural-folded form.
 * `"The Pizzas!"` and `"pizza"` normalise to the same key.
 */
export function normalizeAnswer(raw: unknown): string {
  return normalizeBase(raw, { foldPlurals: true });
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
