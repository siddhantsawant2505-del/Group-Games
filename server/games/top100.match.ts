/**
 * Top 100 — guess matching and round scoring.
 *
 * Pure, dependency-free and unit-testable (`npm run test:top100`). Everything in
 * here is deliberately side-effect free: give it a list, some guesses and the
 * room's duplicate policy, and it answers what each guess matched and scored.
 * The engine (`server/games/top100.ts`) owns state, timers and awards.
 *
 * Matching rules (in order):
 *   1. exact match on the normalised guess against the normalised item name or
 *      any of its aliases;
 *   2. typo tolerance — edit distance <= 1 for guesses of at least 5 characters,
 *      <= 2 for at least 10 characters, and ONLY when exactly one item is inside
 *      that window. Two or more candidates means the guess is ambiguous and
 *      counts as no match (the host can still overrule it on the guesses reveal).
 *
 * Scoring: a match at position N scores exactly N points, anything else scores 0.
 */

import { Top100DuplicatePolicy, Top100Item, Top100List } from '../../shared/types';
import { cleanAnswerText, editDistanceWithin, normalizeBase } from './textNormalize';

/** A missing guess is stored — and displayed — as this. It always scores 0. */
export const TOP100_NO_ANSWER_LABEL = '(no answer)';

/** Guesses are short free text: one phrase, no autocomplete, no suggestions. */
export const TOP100_MAX_GUESS_WORDS = 6;
export const TOP100_MAX_GUESS_CHARS = 60;

/** Typo windows. The wider window only opens for long guesses. */
export const TOP100_TYPO_MIN_CHARS = 5;
export const TOP100_TYPO_MAX_DISTANCE = 1;
export const TOP100_WIDE_TYPO_MIN_CHARS = 10;
export const TOP100_WIDE_TYPO_MAX_DISTANCE = 2;

/** Positions that are revealed at results (everything else stays hidden). */
export const TOP100_TOP_SLICE_SIZE = 10;
export const TOP100_BOTTOM_SLICE_SIZE = 11; // ranks 90-100

export type Top100MatchKind = 'exact' | 'typo' | 'none';

export interface Top100Match {
  /** 1-100 when the guess is on the list, null when it is not. */
  rank: number | null;
  name: string | null;
  kind: Top100MatchKind;
  /**
   * True when the guess was inside a typo window of two or more different items,
   * so it could not be resolved automatically.
   */
  ambiguous: boolean;
}

/**
 * Guesses are cleaned exactly like other free-text answers: control characters
 * and angle brackets stripped, whitespace collapsed, then capped to six words /
 * 60 characters so a card on the board can never blow the layout.
 */
export function sanitizeTop100Guess(raw: unknown): string {
  const cleaned = cleanAnswerText(raw);
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .slice(0, TOP100_MAX_GUESS_WORDS)
    .join(' ')
    .slice(0, TOP100_MAX_GUESS_CHARS)
    .trim();
}

/** The comparison key for a guess or an item name (same pipeline as the index). */
export function normalizeTop100Text(raw: unknown): string {
  return normalizeBase(raw, { foldPlurals: false });
}

export interface Top100MatchIndex {
  listId: string;
  /** Normalised name/alias → the item it belongs to. */
  byKey: Map<string, Top100Item>;
}

/**
 * Builds the lookup for one list: canonical names plus every alias, all
 * normalised. Aliases are unique across a list (enforced by
 * `npm run validate:top100`), so a key can never point at two ranks.
 */
export function buildTop100MatchIndex(list: Top100List): Top100MatchIndex {
  const byKey = new Map<string, Top100Item>();

  list.items.forEach((item) => {
    [item.name, ...item.aliases].forEach((candidate) => {
      const key = normalizeTop100Text(candidate);
      if (key && !byKey.has(key)) byKey.set(key, item);
    });
  });

  return { listId: list.id, byKey };
}

/** How wide a typo window this guess qualifies for, or 0 for none. */
function typoWindowFor(normalized: string): number {
  if (normalized.length >= TOP100_WIDE_TYPO_MIN_CHARS) return TOP100_WIDE_TYPO_MAX_DISTANCE;
  if (normalized.length >= TOP100_TYPO_MIN_CHARS) return TOP100_TYPO_MAX_DISTANCE;
  return 0;
}

/**
 * Resolves one guess against a list. Exact hits win outright; typo hits are only
 * accepted when they are unambiguous.
 */
export function matchTop100Guess(index: Top100MatchIndex, rawGuess: unknown): Top100Match {
  const normalized = normalizeTop100Text(rawGuess);
  if (!normalized) return { rank: null, name: null, kind: 'none', ambiguous: false };

  const exact = index.byKey.get(normalized);
  if (exact) {
    return { rank: exact.rank, name: exact.name, kind: 'exact', ambiguous: false };
  }

  const window = typoWindowFor(normalized);
  if (window === 0) return { rank: null, name: null, kind: 'none', ambiguous: false };

  // Compare against every distinct key (an item with aliases appears once per
  // key, so collect candidate ranks instead of counting keys).
  const candidates = new Map<number, Top100Item>();
  index.byKey.forEach((item, key) => {
    if (candidates.has(item.rank)) return;
    if (editDistanceWithin(normalized, key, window) === null) return;
    candidates.set(item.rank, item);
  });

  if (candidates.size === 1) {
    const item = [...candidates.values()][0];
    return { rank: item.rank, name: item.name, kind: 'typo', ambiguous: false };
  }

  return { rank: null, name: null, kind: 'none', ambiguous: candidates.size > 1 };
}

/* ─────────────────────────────── Round scoring ─────────────────────────────── */

export interface Top100GuessInput {
  /** playerId in solo mode, teamId in team mode. */
  rowId: string;
  /** The locked guess, or TOP100_NO_ANSWER_LABEL. */
  text: string;
}

/**
 * Host overrules, keyed by row: a forced rank, or null for "not on the list".
 * A value that is not a whole number inside 1-100 is ignored.
 */
export type Top100Overrules = Record<string, number | null | undefined>;

export type Top100MatchSource = 'exact' | 'typo' | 'overrule' | 'none';

export interface Top100ScoredGuess {
  rowId: string;
  matchedRank: number | null;
  matchedName: string | null;
  points: number;
  /** At least one other guess landed on the same item. */
  duplicate: boolean;
  /** The room's duplicate policy zeroed this guess. */
  zeroedByDuplicate: boolean;
  /** The host overruled the automatic result. */
  overruled: boolean;
  matchedBy: Top100MatchSource;
  /** The automatic matcher could not decide (host may overrule). */
  ambiguous: boolean;
  /** Normalised guess, used for the unmatched-guess log. */
  normalized: string;
}

function isValidRank(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100;
}

/**
 * Scores one round.
 *
 * @param list            the hidden list the guesses are measured against
 * @param guesses         one entry per player (solo) or team
 * @param duplicatePolicy 'allow' keeps every duplicate's points, 'zero' wipes
 *                        the whole group when two or more rows matched the same
 *                        item
 * @param overrules       host overrules applied before points are finalised
 *
 * The result is returned in the same order as `guesses` (the board order), and
 * carries the rowId so callers can join it back to the rows they built.
 */
export function scoreTop100Round(
  list: Top100List,
  guesses: Top100GuessInput[],
  duplicatePolicy: Top100DuplicatePolicy,
  overrules: Top100Overrules = {}
): Top100ScoredGuess[] {
  const index = buildTop100MatchIndex(list);

  const scored = guesses.map((guess) => {
    const normalized = normalizeTop100Text(guess.text);
    const automatic = matchTop100Guess(index, guess.text);
    const overrule = overrules[guess.rowId];

    let matchedRank = automatic.rank;
    let matchedName = automatic.name;
    let matchedBy: Top100MatchSource = automatic.kind === 'none' ? 'none' : automatic.kind;
    let overruled = false;

    if (overrule !== undefined) {
      overruled = true;
      if (isValidRank(overrule)) {
        matchedRank = overrule;
        matchedName = list.items.find((item) => item.rank === overrule)?.name ?? matchedName;
        matchedBy = 'overrule';
      } else {
        // null (or an unusable value) means "the host says this is not on the list".
        matchedRank = null;
        matchedName = null;
        matchedBy = 'none';
      }
    }

    return {
      rowId: guess.rowId,
      matchedRank,
      matchedName,
      points: matchedRank ?? 0,
      duplicate: false,
      zeroedByDuplicate: false,
      overruled,
      matchedBy,
      ambiguous: automatic.ambiguous,
      normalized,
    };
  });

  // Duplicate policy: group the rows that ended up on the same item.
  const byRank = new Map<number, Top100ScoredGuess[]>();
  scored.forEach((row) => {
    if (row.matchedRank === null) return;
    const group = byRank.get(row.matchedRank) ?? [];
    group.push(row);
    byRank.set(row.matchedRank, group);
  });

  byRank.forEach((group) => {
    if (group.length < 2) return;
    group.forEach((row) => {
      row.duplicate = true;
      if (duplicatePolicy === 'zero') {
        row.points = 0;
        row.zeroedByDuplicate = true;
      }
    });
  });

  return scored;
}

/* ───────────────────────────── Revealed list slices ───────────────────────── */

export interface Top100SliceEntryResult {
  rank: number;
  name: string;
}

/**
 * The ONLY parts of a list that may leave the server: the easiest ten positions
 * (1-10) and the hardest eleven (90-100). Deliberately takes the list so callers
 * cannot accidentally ship `items` instead.
 */
export function buildTop100Slices(list: Top100List): {
  top: Top100SliceEntryResult[];
  bottom: Top100SliceEntryResult[];
} {
  const sorted = [...list.items].sort((a, b) => a.rank - b.rank);
  const pick = (ranks: number[]) =>
    ranks
      .map((rank) => sorted.find((item) => item.rank === rank))
      .filter((item): item is Top100Item => Boolean(item))
      .map((item) => ({ rank: item.rank, name: item.name }));

  const topRanks = Array.from({ length: TOP100_TOP_SLICE_SIZE }, (_, index) => index + 1);
  const bottomRanks = Array.from(
    { length: TOP100_BOTTOM_SLICE_SIZE },
    (_, index) => 100 - TOP100_BOTTOM_SLICE_SIZE + index + 1
  );

  return { top: pick(topRanks), bottom: pick(bottomRanks) };
}
