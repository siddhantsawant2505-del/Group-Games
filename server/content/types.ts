/**
 * Content-engine contracts.
 *
 * Every game that needs generated or bundled content (Impostor words, Impostor
 * question pairs, and later taboo sets / link concepts / spectrum prompts)
 * pulls it through a `ContentProvider`. Providers are asynchronous because they
 * may top themselves up from the AI client in the background, but the shipped
 * pools are served synchronously in practice: a round never waits on the AI.
 */

export interface ContentProvider<T> {
  /**
   * Hands out the next item for a room.
   *
   * `opts` is intentionally loose so each provider can document its own shape
   * (see `WordRequestOptions`). Implementations must never reject: if anything
   * goes wrong they fall back to bundled content.
   */
  next(roomId: string, opts?: Record<string, unknown>): Promise<T>;

  /** Drops every per-room bag, history and rate-limit counter for a room. */
  release(roomId: string): void;
}

/** Host-facing difficulty setting, shared by the content providers. */
export type ContentDifficulty = 'easy' | 'medium' | 'any';

/** One word from the shipped corpus or the AI top-up. */
export interface WordItem {
  id: string;
  word: string;
  category: string;
  /** 1 = everyday, 2 = less common, 3 = rarer. */
  difficulty: 1 | 2 | 3;
  source: 'corpus' | 'ai';
}

/** Documented shape of `opts` for the word provider. */
export interface WordRequestOptions {
  /** Defaults to 'easy'. 'easy' = tier 1, 'medium' = tiers 2-3, 'any' = everything. */
  difficulty?: ContentDifficulty;
  /** Optional host-authored topic; treated strictly as data by the AI prompt. */
  theme?: string;
}

export const DEFAULT_CONTENT_DIFFICULTY: ContentDifficulty = 'easy';

export function readDifficulty(value: unknown): ContentDifficulty {
  return value === 'medium' || value === 'any' || value === 'easy'
    ? value
    : DEFAULT_CONTENT_DIFFICULTY;
}

/**
 * Sanitises a host-authored theme before it can reach a prompt: trimmed to 40
 * characters, control characters removed, whitespace collapsed. The result is
 * always embedded as data, never as an instruction.
 */
export function sanitizeTheme(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

/** Lowercase, letters only: the single normalised form used for comparisons. */
export function normalizeContentWord(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .trim();
}
