/**
 * Persistent puzzle library + per-room no-repeat bag.
 *
 * Seeds ship with the repo; everything else accumulates under
 * data/puzzle-library (gitignored). Rooms draw their next puzzle from here
 * before the generator is ever asked for one.
 */

import fs from 'node:fs';
import path from 'node:path';
import { GuessLinkPuzzle, GtlDifficultySetting } from '../../../shared/types';
import { INDEX_FILE, LIBRARY_DIR, loadImageDirectory } from './imageStore';
import { SEED_LINK_PUZZLES } from './seedPuzzles';

export const LIBRARY_MAX = Number(process.env.LIBRARY_MAX) || 500;

const puzzles = new Map<string, GuessLinkPuzzle>();
/** roomCode -> puzzle ids already played (a bag that refills when exhausted). */
const roomBags = new Map<string, Set<string>>();
/** roomCode + band -> ids in the current shuffle bag. */
const shuffleBags = new Map<string, string[]>();

function loadFromDisk() {
  try {
    const parsed = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    const entries: GuessLinkPuzzle[] = Array.isArray(parsed?.puzzles) ? parsed.puzzles : [];
    for (const puzzle of entries) {
      if (puzzle?.id) puzzles.set(puzzle.id, puzzle);
    }
  } catch {
    // No library yet: seeds alone are enough to start.
  }
}

function persist() {
  try {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
    const ordered = [...puzzles.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    fs.writeFileSync(
      INDEX_FILE,
      JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), puzzles: ordered }, null, 2)
    );
  } catch (error) {
    console.log(`[guess-link] Could not persist the puzzle library: ${String(error)}`);
  }
}

let loaded = false;

/** Loads seeds once, then the generated library on top of them. */
export function ensureLibraryLoaded() {
  if (loaded) return;
  loaded = true;
  for (const seed of SEED_LINK_PUZZLES) puzzles.set(seed.id, { ...seed });
  loadImageDirectory();
  loadFromDisk();
}

export function allPuzzles(): GuessLinkPuzzle[] {
  ensureLibraryLoaded();
  return [...puzzles.values()];
}

export function getPuzzle(id: string): GuessLinkPuzzle | undefined {
  ensureLibraryLoaded();
  return puzzles.get(id);
}

function bandOf(puzzle: GuessLinkPuzzle): 'easy' | 'medium' | 'hard' {
  return puzzle.difficulty === 1 ? 'easy' : puzzle.difficulty === 2 ? 'medium' : 'hard';
}

/** Plays allow only enabled puzzles of the requested band (theme bypasses). */
function eligible(settings: { difficulty: GtlDifficultySetting; theme?: string }) {
  return allPuzzles().filter((puzzle) => {
    if (puzzle.quality.disabled) return false;
    if (settings.theme) return puzzle.quality.solverChecked !== false;
    if (settings.difficulty === 'mixed') return true;
    return bandOf(puzzle) === settings.difficulty;
  });
}

/** Deterministic-ish non-repeating pick for one room. */
export function drawPuzzle(
  roomCode: string,
  settings: { difficulty: GtlDifficultySetting; theme?: string }
): GuessLinkPuzzle | null {
  ensureLibraryLoaded();
  const pool = eligible(settings);
  if (pool.length === 0) return null;

  const played = roomBags.get(roomCode) ?? new Set<string>();
  roomBags.set(roomCode, played);

  const key = `${roomCode}:${settings.theme ? `theme:${settings.theme}` : settings.difficulty}`;
  let bag = shuffleBags.get(key) ?? [];
  bag = bag.filter((id) => !played.has(id) && pool.some((puzzle) => puzzle.id === id));
  if (bag.length === 0) {
    // Exhausted: refill the bag once every puzzle has been played.
    const fresh = pool.filter((puzzle) => !played.has(puzzle.id));
    if (fresh.length === 0) {
      played.clear();
      bag = pool.map((puzzle) => puzzle.id);
    } else {
      bag = fresh.map((puzzle) => puzzle.id);
    }
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }

  const id = bag.shift()!;
  shuffleBags.set(key, bag);
  const puzzle = puzzles.get(id) ?? null;
  if (puzzle) recordUse(roomCode, puzzle.id);
  return puzzle;
}

/** Records a play: room bag, use count, and basic LRU eviction. */
export function recordUse(roomCode: string, puzzleId: string) {
  const played = roomBags.get(roomCode) ?? new Set<string>();
  played.add(puzzleId);
  roomBags.set(roomCode, played);

  const puzzle = puzzles.get(puzzleId);
  if (puzzle) {
    puzzle.useCount += 1;
    persist();
  }
  evictIfNeeded();
}

export function releaseRoomBag(roomCode: string) {
  roomBags.delete(roomCode);
  for (const key of [...shuffleBags.keys()]) {
    if (key.startsWith(`${roomCode}:`)) shuffleBags.delete(key);
  }
}

/** Keeps the least-used, then oldest puzzles when the cap is reached. */
export function evictIfNeeded() {
  const generated = allPuzzles().filter((puzzle) => !puzzle.id.startsWith('seed-'));
  if (generated.length <= LIBRARY_MAX) return;
  generated
    .sort((a, b) => a.useCount - b.useCount || a.createdAt.localeCompare(b.createdAt))
    .slice(0, generated.length - LIBRARY_MAX)
    .forEach((puzzle) => puzzles.delete(puzzle.id));
  persist();
}

export function addPuzzle(puzzle: GuessLinkPuzzle, options: { persist?: boolean } = {}): boolean {
  ensureLibraryLoaded();
  if (puzzles.has(puzzle.id)) return false;
  puzzles.set(puzzle.id, puzzle);
  for (const item of puzzle.items) {
    if (item.imageToken) {
      // Tokens are registered by imageStore; the served set stays bounded by
      // the library index because only library puzzles publish tokens.
    }
  }
  if (options.persist !== false) persist();
  evictIfNeeded();
  return true;
}

export function setPuzzleDisabled(id: string, disabled: boolean): boolean {
  const puzzle = puzzles.get(id);
  if (!puzzle) return false;
  puzzle.quality.disabled = disabled;
  persist();
  return true;
}

export function librarySize(): number {
  return allPuzzles().length;
}

export function libraryStats() {
  const all = allPuzzles();
  const byBand = { easy: 0, medium: 0, hard: 0 };
  all.forEach((puzzle) => {
    byBand[bandOf(puzzle)] += 1;
  });
  return {
    total: all.length,
    generated: all.filter((puzzle) => !puzzle.id.startsWith('seed-')).length,
    seeds: all.filter((puzzle) => puzzle.id.startsWith('seed-')).length,
    disabled: all.filter((puzzle) => puzzle.quality.disabled).length,
    withImages: all.filter((puzzle) => puzzle.items.some((item) => item.imageToken)).length,
    byBand,
    dir: path.relative(process.cwd(), LIBRARY_DIR),
  };
}

/** Used by tests to return to a clean bag. */
export function resetLibraryForTests() {
  roomBags.clear();
  shuffleBags.clear();
}
