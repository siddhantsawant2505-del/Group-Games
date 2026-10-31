/**
 * Library-first puzzle provider.
 *
 * A round never waits for the model: the library (seeds included) answers
 * synchronously, while `prepare()` tops up a per-room lookahead buffer and the
 * warm pool in the background. Only when both are empty does the caller fall
 * back to emoji seeds.
 */

import { GuessLinkPuzzle, GtlSettings } from '../../../shared/types';
import { SEED_LINK_PUZZLES } from './seedPuzzles';
import { allPuzzles, drawPuzzle, recordUse } from './puzzleLibrary';
import { generatePuzzle, GenerateOptions } from './puzzleGenerator';
import { IMAGE_CONCURRENCY, imageBudget, LINK_IMAGE_DAILY_BUDGET } from './imageProvider';
import { isAiAvailable } from '../aiClient';

export const WARM_POOL_SIZE = Number(process.env.WARM_POOL_SIZE) || 6;
export const LOOKAHEAD_DEPTH = Number(process.env.LOOKAHEAD_DEPTH) || 2;

export interface ProviderStats {
  library: { total: number; generated: number; seeds: number; withImages: number; disabled: number };
  bufferDepth: number;
  roomsPreparing: number;
  avgTextMs: number;
  avgImageMs: number;
  onDemandGenerations: number;
  fallbackCount: number;
  imageBudget: { used: number; limit: number; concurrency: number };
  warmPool: { target: number; running: boolean };
}

interface RoomBuffer {
  queue: GuessLinkPuzzle[];
  preparing: boolean;
  used: string[];
}

const buffers = new Map<string, RoomBuffer>();
let warmTimer: NodeJS.Timeout | null = null;
const stats = {
  onDemand: 0,
  fallbacks: 0,
  textMs: [] as number[],
  imageMs: [] as number[],
};

function bufferFor(roomCode: string): RoomBuffer {
  let buffer = buffers.get(roomCode);
  if (!buffer) {
    buffer = { queue: [], preparing: false, used: [] };
    buffers.set(roomCode, buffer);
  }
  return buffer;
}

function matchesSettings(puzzle: GuessLinkPuzzle, settings: GtlSettings) {
  if (settings.difficulty === 'mixed') return true;
  const band = puzzle.difficulty === 1 ? 'easy' : puzzle.difficulty === 2 ? 'medium' : 'hard';
  return band === settings.difficulty;
}

export function getRoomBufferDepth(roomCode: string): number {
  return buffers.get(roomCode)?.queue.length ?? 0;
}

/**
 * Synchronous round draw. Order: prepared buffer -> settings-matching library ->
 * any library puzzle -> shipped seed. Never blocks the phase machine.
 */
export function takePuzzle(roomCode: string, settings: GtlSettings): GuessLinkPuzzle | null {
  const buffer = bufferFor(roomCode);
  const queued = buffer.queue.findIndex(
    (puzzle) =>
      !buffer.used.includes(puzzle.id) &&
      (!settings.theme || puzzle.quality.solverChecked) &&
      matchesSettings(puzzle, settings)
  );
  if (queued >= 0) {
    const [puzzle] = buffer.queue.splice(queued, 1);
    buffer.used.push(puzzle.id);
    recordUse(roomCode, puzzle.id);
    void prepare(roomCode, settings);
    return puzzle;
  }

  const drawn = drawPuzzle(roomCode, settings);
  if (drawn) {
    buffer.used.push(drawn.id);
    void prepare(roomCode, settings);
    return drawn;
  }

  const any = allPuzzles().find((puzzle) => !puzzle.quality.disabled);
  if (any) {
    stats.fallbacks += 1;
    console.log(`[guess-link] Room ${roomCode}: no puzzle matched the settings, using the library.`);
    recordUse(roomCode, any.id);
    return any;
  }

  const seed = SEED_LINK_PUZZLES.find((puzzle) => !puzzle.quality.disabled) ?? SEED_LINK_PUZZLES[0];
  if (seed) {
    stats.fallbacks += 1;
    console.log(`[guess-link] Room ${roomCode}: library empty, falling back to a seed puzzle.`);
    recordUse(roomCode, seed.id);
  }
  return seed ?? null;
}

function bandFor(settings: GtlSettings): string {
  if (settings.difficulty === 'mixed') return String(1 + Math.floor(Math.random() * 3));
  return settings.difficulty === 'easy' ? '1' : settings.difficulty === 'medium' ? '2' : '3';
}

/** Text + image generation with timing, in the background. */
async function generateOne(settings: GtlSettings, options: GenerateOptions = {}) {
  if (!isAiAvailable() || !imageBudget.available) return null;
  const started = Date.now();
  stats.onDemand += 1;
  const puzzle = await generatePuzzle({
    difficulty: bandFor(settings),
    theme: settings.theme,
    ...options,
  });
  const elapsed = Date.now() - started;
  stats.textMs.push(elapsed);
  if (stats.textMs.length > 40) stats.textMs.shift();
  return puzzle;
}

let warmRunning = false;

/** Fills the warm pool once; safe to call on every game select. */
export async function warmPool(): Promise<void> {
  if (warmRunning) return;
  warmRunning = true;
  try {
    const seedCount = allPuzzles().filter((puzzle) => puzzle.id.startsWith('seed-')).length;
    const generated = allPuzzles().filter((puzzle) => !puzzle.id.startsWith('seed-')).length;
    const target = seedCount + WARM_POOL_SIZE;
    while (generated < target && isAiAvailable() && imageBudget.available) {
      const puzzle = await generateOne({ ...({} as GtlSettings), difficulty: 'mixed' });
      if (!puzzle) break;
    }
  } finally {
    warmRunning = false;
  }
}

/** Per-room lookahead: keeps LOOKAHEAD_DEPTH matching puzzles ready. */
export async function prepare(roomCode: string, settings: GtlSettings): Promise<void> {
  const buffer = bufferFor(roomCode);
  if (buffer.preparing) return;
  if (!isAiAvailable() || !imageBudget.available) return;
  if (buffer.queue.length >= LOOKAHEAD_DEPTH) return;

  buffer.preparing = true;
  try {
    while (buffer.queue.length < LOOKAHEAD_DEPTH) {
      const puzzle = await generateOne(settings);
      if (!puzzle) break;
      buffer.queue.push(puzzle);
    }
  } finally {
    buffer.preparing = false;
  }
}

export function releaseRoomBuffer(roomCode: string): void {
  buffers.delete(roomCode);
}

export function providerStats(): ProviderStats {
  const library = allPuzzles();
  let depth = 0;
  buffers.forEach((buffer) => {
    depth += buffer.queue.length;
  });
  const avg = (values: number[]) =>
    values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  return {
    library: {
      total: library.length,
      generated: library.filter((puzzle) => !puzzle.id.startsWith('seed-')).length,
      seeds: library.filter((puzzle) => puzzle.id.startsWith('seed-')).length,
      withImages: library.filter((puzzle) => puzzle.items.every((item) => item.imageToken)).length,
      disabled: library.filter((puzzle) => puzzle.quality.disabled).length,
    },
    bufferDepth: depth,
    roomsPreparing: [...buffers.values()].filter((buffer) => buffer.preparing).length,
    avgTextMs: avg(stats.textMs),
    avgImageMs: avg(stats.imageMs),
    onDemandGenerations: stats.onDemand,
    fallbackCount: stats.fallbacks,
    imageBudget: {
      used: imageBudget.usedToday,
      limit: LINK_IMAGE_DAILY_BUDGET,
      concurrency: IMAGE_CONCURRENCY,
    },
    warmPool: { target: WARM_POOL_SIZE, running: warmRunning },
  };
}

/** Starts the warm pool shortly after boot, once env and AI status are known. */
export function startWarmPool(): void {
  if (warmTimer) return;
  warmTimer = setTimeout(() => {
    warmTimer = null;
    void warmPool();
  }, 1_500);
  if (typeof warmTimer.unref === 'function') warmTimer.unref();
}
