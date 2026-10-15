/**
 * Top 100 — unmatched guess log.
 *
 * Every guess that matched nothing is recorded here (list id + normalised text +
 * count) so aliases can be improved later. It deliberately records NO player
 * identity: the file is a content-maintenance aid, not a scoreboard.
 *
 * Writes are best-effort: a read-only filesystem or a missing `data/` directory
 * must never break a round, so every failure is swallowed after one warning.
 */

import fs from 'node:fs';
import path from 'node:path';

export const UNMATCHED_GUESSES_FILE = 'data/unmatched-guesses.json';

export interface UnmatchedGuessLog {
  /** listId → normalised guess → how many times it was seen. */
  lists: Record<string, Record<string, number>>;
  updatedAt?: string;
}

/** Where the log lives. `TOP100_UNMATCHED_LOG` overrides it (used by tests). */
export function unmatchedGuessLogPath(): string {
  const override = (process.env.TOP100_UNMATCHED_LOG || '').trim();
  if (override) return path.resolve(process.cwd(), override);
  return path.resolve(process.cwd(), UNMATCHED_GUESSES_FILE);
}

function readLog(filePath: string): UnmatchedGuessLog {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as UnmatchedGuessLog | null;
    if (parsed && typeof parsed === 'object' && parsed.lists && typeof parsed.lists === 'object') {
      return parsed;
    }
    return { lists: {} };
  } catch {
    return { lists: {} };
  }
}

/**
 * Counts the guesses that matched nothing.
 * @returns the file path the log was written to, or null when writing failed.
 */
export function logUnmatchedGuesses(
  listId: string,
  normalizedGuesses: readonly string[],
  options: { filePath?: string } = {}
): string | null {
  const cleaned = normalizedGuesses
    .map((guess) => (guess || '').trim())
    .filter((guess) => guess.length > 0 && guess.length <= 60);
  if (!listId || cleaned.length === 0) return null;

  const filePath = options.filePath ?? unmatchedGuessLogPath();
  try {
    const log = readLog(filePath);
    const bucket = { ...(log.lists[listId] ?? {}) };
    cleaned.forEach((guess) => {
      bucket[guess] = (bucket[guess] ?? 0) + 1;
    });
    log.lists = { ...log.lists, [listId]: bucket };
    log.updatedAt = new Date().toISOString();

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
    return filePath;
  } catch (error) {
    console.warn('[top100] could not write the unmatched-guess log:', (error as Error)?.message);
    return null;
  }
}

/** Test hook: reads the log back (empty object when it does not exist yet). */
export function readUnmatchedGuesses(filePath?: string): UnmatchedGuessLog {
  return readLog(filePath ?? unmatchedGuessLogPath());
}
