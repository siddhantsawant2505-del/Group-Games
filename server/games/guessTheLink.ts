/**
 * Guess the Link — three images, one hidden connection.
 *
 * Server-authoritative. The link, its aliases and each item's name stay inside
 * this module until the round results; public state carries only emoji tiles,
 * image URLs once a round starts, the solve feed and — at results — the reveal.
 *
 * Flow: reveal (get ready) -> guess (live attempts) -> results.
 * Scoring goes through awardPoints()/awardTeamPoints() only.
 */

import { InternalRoom } from '../roomManager';
import { awardPoints } from '../scoring';
import { awardTeamPoints } from '../scoring';
import {
  DEFAULT_GTL_SETTINGS,
  GTL_SETTINGS_LIMITS,
  GuessLinkPuzzle,
  GtlPublicState,
  GtlSettings,
  GtlWrongGuess,
  PlayerResultStanding,
} from '../../shared/types';
import { SEED_LINK_PUZZLES } from '../content/guessTheLink/seedPuzzles';

/** Points by solve order: 1st +3, 2nd +2, everyone later +1. */
export const GTL_POINTS_BY_ORDER = [3, 2, 1] as const;
export const GTL_OVERRULE_POINTS = 1;
export const GTL_REVEAL_SECONDS = 15;
export const GTL_GUESS_SECONDS = 60;
export const GTL_INPUT_SECONDS = 0;
export const GTL_MAX_GUESS_CHARS = 40;
export const GTL_BOT_MIN_DELAY_MS = 4_000;
export const GTL_BOT_MAX_DELAY_MS = 18_000;

interface GtlRow {
  /** playerId in solo mode, teamId in team mode. */
  id: string;
  label: string;
  colorIndex: number;
  used: number;
  solved: boolean;
  verdicts: boolean[];
}

interface GtlRoundState {
  puzzle: GuessLinkPuzzle;
  phase: 'ready' | 'guessing' | 'results';
  rows: Map<string, GtlRow>;
  solvedOrder: { rowId: string; seconds: number }[];
  wrongGuesses: GtlWrongGuess[];
  hintShown: boolean;
  startedAt: number;
  roundPoints: Map<string, number>;
  overruledWrong: Set<number>;
  usedPuzzleIds: string[];
  roundsPlayed: number;
}

const activeRounds = new Map<string, GtlRoundState>();

export function getGtlRoundState(roomCode: string): GtlRoundState | undefined {
  return activeRounds.get(roomCode);
}

export function cleanupGtlRound(roomCode: string): void {
  activeRounds.delete(roomCode);
}

/** Reads the public settings, clamping anything the host sent out of range. */
export function readGtlSettings(room: InternalRoom): GtlSettings {
  const raw = room.gameSettings?.guessTheLink;
  const clamp = (value: number | undefined, min: number, max: number, fallback: number) => {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };
  return {
    roundCount: clamp(
      raw?.roundCount,
      GTL_SETTINGS_LIMITS.roundCount.min,
      GTL_SETTINGS_LIMITS.roundCount.max,
      DEFAULT_GTL_SETTINGS.roundCount
    ),
    roundSeconds: clamp(
      raw?.roundSeconds,
      GTL_SETTINGS_LIMITS.roundSeconds.min,
      GTL_SETTINGS_LIMITS.roundSeconds.max,
      DEFAULT_GTL_SETTINGS.roundSeconds
    ),
    attempts: clamp(
      raw?.attempts,
      GTL_SETTINGS_LIMITS.attempts.min,
      GTL_SETTINGS_LIMITS.attempts.max,
      DEFAULT_GTL_SETTINGS.attempts
    ),
    difficulty: raw?.difficulty ?? DEFAULT_GTL_SETTINGS.difficulty,
    hintEnabled: raw?.hintEnabled !== false,
    ...(raw?.theme ? { theme: raw.theme } : {}),
  };
}

/** Guess sanitizer: one short phrase, control characters removed. */
export function sanitizeGtlGuess(raw: string): string {
  return (raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, GTL_MAX_GUESS_CHARS);
}

/** Normalizes an answer: lowercase, accents stripped, punctuation gone. */
export function normalizeGtlText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(the|a|an)\b\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s$/, '');
}

/** Levenshtein distance, bounded by the strings' lengths. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** Local judgement: exact link/alias, then a small typo allowance. */
export function isCorrectGtlGuess(puzzle: GuessLinkPuzzle, rawGuess: string): boolean {
  const guess = normalizeGtlText(rawGuess);
  if (!guess) return false;
  const accepted = [puzzle.link, ...puzzle.aliases].map(normalizeGtlText).filter(Boolean);
  if (accepted.includes(guess)) return true;
  return accepted.some((answer) => {
    const tolerance = answer.length >= 10 ? 2 : answer.length >= 5 ? 1 : 0;
    return tolerance > 0 && editDistance(guess, answer) <= tolerance;
  });
}

function rowsFor(room: InternalRoom, settings: GtlSettings): GtlRow[] {
  if (room.playMode === 'team' && room.teams.length > 0) {
    return room.teams.map((team) => ({
      id: team.id,
      label: team.name,
      colorIndex: team.accentIndex,
      used: 0,
      solved: false,
      verdicts: [],
    }));
  }
  return room.players.map((player) => ({
    id: player.id,
    label: player.name,
    colorIndex: player.colorIndex,
    used: 0,
    solved: false,
    verdicts: [],
  }));
}

function puzzlePool(settings: GtlSettings, used: string[]): GuessLinkPuzzle[] {
  const byDifficulty =
    settings.difficulty === 'mixed'
      ? SEED_LINK_PUZZLES
      : SEED_LINK_PUZZLES.filter(
          (puzzle) =>
            (settings.difficulty === 'easy' && puzzle.difficulty === 1) ||
            (settings.difficulty === 'medium' && puzzle.difficulty === 2) ||
            (settings.difficulty === 'hard' && puzzle.difficulty === 3)
        );
  const enabled = byDifficulty.filter((puzzle) => !puzzle.quality.disabled);
  if (enabled.length === 0) return SEED_LINK_PUZZLES;
  const fresh = enabled.filter((puzzle) => !used.includes(puzzle.id));
  return fresh.length > 0 ? fresh : enabled;
}

function pickPuzzle(settings: GtlSettings, used: string[]): GuessLinkPuzzle {
  const pool = puzzlePool(settings, used);
  const picked = pool[Math.floor(Math.random() * pool.length)];
  picked.useCount += 1;
  return picked;
}

/**
 * 1. Get ready: pick the round's puzzle and publish only its emoji tiles.
 * Image URLs are attached at the same moment, because a round is about to start.
 */
export function setupGtlRound(room: InternalRoom): void {
  const settings = readGtlSettings(room);
  if (!room.totalRounds || room.totalRounds !== settings.roundCount) {
    room.totalRounds = settings.roundCount;
  }
  const previous = activeRounds.get(room.code);
  const usedPuzzleIds = previous?.usedPuzzleIds ?? [];
  const puzzle = pickPuzzle(settings, usedPuzzleIds);

  const state: GtlRoundState = {
    puzzle,
    phase: 'ready',
    rows: new Map(rowsFor(room, settings).map((row) => [row.id, row])),
    solvedOrder: [],
    wrongGuesses: [],
    hintShown: false,
    startedAt: 0,
    roundPoints: new Map(),
    overruledWrong: new Set(),
    usedPuzzleIds: [...usedPuzzleIds, puzzle.id].slice(-SEED_LINK_PUZZLES.length),
    roundsPlayed: previous?.roundsPlayed ?? 0,
  };
  activeRounds.set(room.code, state);
  room.privateData = {};
  syncGtlPublicState(room);
  room.phasePrompt = 'Get Ready';
  room.phaseSubprompt = 'Three pictures, one hidden link — you have a few seconds';
}

/** Publishes the public round state (never the link before results). */
export function syncGtlPublicState(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) {
    room.gtlState = null;
    return;
  }
  const settings = readGtlSettings(room);
  const revealed = state.phase === 'results';
  const attemptsUsed: Record<string, number> = {};
  state.rows.forEach((row, id) => {
    attemptsUsed[id] = row.used;
  });

  const publicState: GtlPublicState = {
    phase: state.phase,
    roundNumber: room.roundNumber,
    roundCount: settings.roundCount,
    clues: state.puzzle.items.map((item) => ({
      emoji: item.emoji,
      imageUrl: item.imageToken ? `/api/guess-link/img/${item.imageToken}` : null,
    })),
    seconds: room.timer?.remainingSeconds ?? 0,
    attempts: settings.attempts,
    hintEnabled: settings.hintEnabled,
    hint: state.hintShown ? state.puzzle.hint : null,
    solved: state.solvedOrder.map((entry) => {
      const row = state.rows.get(entry.rowId);
      return {
        rowId: entry.rowId,
        name: row?.label ?? 'Player',
        colorIndex: row?.colorIndex ?? 0,
        points: state.roundPoints.get(entry.rowId) ?? 0,
        seconds: entry.seconds,
      };
    }),
    attemptsUsed,
    guessesSubmitted: state.solvedOrder.map((entry) => entry.rowId),
    revealed,
    link: revealed ? state.puzzle.link : null,
    items: revealed
      ? state.puzzle.items.map((item) => ({
          name: item.name,
          emoji: item.emoji,
          imageUrl: item.imageToken ? `/api/guess-link/img/${item.imageToken}` : null,
          caption: item.name,
        }))
      : [],
    wrongGuesses: revealed ? state.wrongGuesses : [],
    finalRound: room.roundNumber >= settings.roundCount,
    gameOver: room.roundNumber >= settings.roundCount && revealed,
  };

  room.gtlState = publicState;
  syncGtlPrivateState(room);
}

/** Mirrors the caller's own attempts/verdicts into private state. */
export function syncGtlPrivateState(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;
  const settings = readGtlSettings(room);
  const rows =
    room.playMode === 'team' && room.teams.length > 0
      ? room.teams.map((team) => ({ teamId: team.id, memberIds: team.memberIds }))
      : [];

  for (const player of room.players) {
    const row =
      room.playMode === 'team' && room.teams.length > 0
        ? state.rows.get(player.teamId || '')
        : state.rows.get(player.id);
    if (!row) continue;
    room.privateData[player.id] = {
      ...(room.privateData[player.id] || {}),
      role: 'Link Seeker',
      gtlAttemptsUsed: row.used,
      gtlAttemptsLeft: Math.max(0, settings.attempts - row.used),
      gtlVerdicts: [...row.verdicts],
      gtlSolved: row.solved,
      gtlConcept: state.phase === 'results' ? state.puzzle.link : undefined,
    };
  }
  void rows;
}

/** 2. Guessing: the countdown ends and every row may start submitting. */
export function beginGtlGuessing(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;
  state.phase = 'guessing';
  state.startedAt = Date.now();
  syncGtlPublicState(room);
  room.phasePrompt = 'Guess the Link';
  room.phaseSubprompt = 'Spot what connects the three pictures';
}

export interface GtlGuessOutcome {
  accepted: boolean;
  correct?: boolean;
  attemptsLeft?: number;
  solved?: boolean;
  pendingRowIds?: string[];
}

/** Judge + score one live guess. Called by the room manager. */
export function recordGtlGuess(
  room: InternalRoom,
  playerId: string,
  rawGuess: string
): GtlGuessOutcome {
  const state = activeRounds.get(room.code);
  if (!state || state.phase !== 'guessing') return { accepted: false };
  const settings = readGtlSettings(room);
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { accepted: false };

  const rowId =
    room.playMode === 'team' && player.teamId ? player.teamId : player.id;
  const row = state.rows.get(rowId);
  if (!row || row.solved || row.used >= settings.attempts) return { accepted: false };

  const guess = sanitizeGtlGuess(rawGuess);
  if (!guess) return { accepted: false };

  row.used += 1;
  const correct = isCorrectGtlGuess(state.puzzle, guess);
  row.verdicts.push(correct);

  if (correct) {
    row.solved = true;
    state.solvedOrder.push({
      rowId,
      seconds: Math.max(1, Math.round((Date.now() - state.startedAt) / 1000)),
    });
    const points =
      GTL_POINTS_BY_ORDER[state.solvedOrder.length - 1] ?? GTL_POINTS_BY_ORDER[GTL_POINTS_BY_ORDER.length - 1];
    state.roundPoints.set(rowId, points);
  } else {
    state.wrongGuesses.push({
      rowId,
      name: row.label,
      guess,
      overruled: false,
    });
  }

  syncGtlPublicState(room);
  const pendingRowIds = [...state.rows.values()]
    .filter((entry) => !entry.solved && entry.used < settings.attempts)
    .map((entry) => entry.id);

  return {
    accepted: true,
    correct,
    attemptsLeft: Math.max(0, settings.attempts - row.used),
    solved: row.solved,
    pendingRowIds,
  };
}

export function pendingGtlGuessers(room: InternalRoom): string[] {
  const state = activeRounds.get(room.code);
  if (!state) return [];
  const settings = readGtlSettings(room);
  return [...state.rows.values()]
    .filter((row) => !row.solved && row.used < settings.attempts)
    .map((row) => row.id);
}

/** 3. Results: reveal, award the round, build the standings. */
export function finalizeGtlGuesses(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;
  state.phase = 'results';
  syncGtlPublicState(room);
}

export function maybeRevealGtlHint(room: InternalRoom): boolean {
  const state = activeRounds.get(room.code);
  if (!state || state.phase !== 'guessing' || state.hintShown) return false;
  const settings = readGtlSettings(room);
  if (!settings.hintEnabled || state.solvedOrder.length > 0) return false;
  const remaining = room.timer?.remainingSeconds ?? 0;
  if (remaining > settings.roundSeconds / 2) return false;
  state.hintShown = true;
  syncGtlPublicState(room);
  return true;
}

/** Host overrule: a wrong guess was actually right (+1, no solve-order points). */
export function applyGtlOverrule(
  room: InternalRoom,
  wrongIndex: number
): { success: boolean; error?: string; points?: number } {
  const state = activeRounds.get(room.code);
  if (!state || state.phase !== 'results') return { success: false, error: 'No round to overrule.' };
  const entry = state.wrongGuesses[wrongIndex];
  if (!entry || entry.overruled) return { success: false, error: 'Pick a wrong guess.' };

  entry.overruled = true;
  state.overruledWrong.add(wrongIndex);

  if (room.playMode === 'team') {
    awardTeamPoints(room, entry.rowId, GTL_OVERRULE_POINTS, 'Guess the Link overrule');
    const team = room.teams.find((t) => t.id === entry.rowId);
    if (team) {
      state.roundPoints.set(entry.rowId, (state.roundPoints.get(entry.rowId) ?? 0) + GTL_OVERRULE_POINTS);
    }
  } else {
    awardPoints(room, entry.rowId, GTL_OVERRULE_POINTS, 'Guess the Link overrule');
    state.roundPoints.set(entry.rowId, (state.roundPoints.get(entry.rowId) ?? 0) + GTL_OVERRULE_POINTS);
  }
  syncGtlPublicState(room);
  return { success: true, points: GTL_OVERRULE_POINTS };
}

/** Applies the round's points (once) and writes the round standings. */
export function calculateGtlResults(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;
  state.phase = 'results';
  const settings = readGtlSettings(room);

  const awarded = new Set<string>();
  state.solvedOrder.forEach((entry) => {
    const points = state.roundPoints.get(entry.rowId) ?? 0;
    if (awarded.has(entry.rowId)) return;
    awarded.add(entry.rowId);
    if (room.playMode === 'team') {
      awardTeamPoints(room, entry.rowId, points, 'Guess the Link solve order');
    } else {
      const solvedRow = state.rows.get(entry.rowId);
      if (solvedRow) {
        const members = room.players.filter((player) => player.id === entry.rowId);
        members.forEach((player) =>
          awardPoints(room, player.id, points, 'Guess the Link solve order')
        );
      }
    }
  });

  const rows: PlayerResultStanding[] = [...room.players]
    .map((player) => {
      const rowId = room.playMode === 'team' && player.teamId ? player.teamId : player.id;
      const pointsAdded = state.roundPoints.get(rowId) ?? 0;
      return {
        playerId: player.id,
        playerName: player.name,
        playerColor: player.colorHex,
        colorIndex: player.colorIndex,
        pointsAdded,
        totalScore: player.score,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
  const standings: PlayerResultStanding[] = rows.map((entry, index) => ({
    ...entry,
    rank:
      index > 0 && rows[index - 1].totalScore === entry.totalScore
        ? rows[index - 1].rank
        : index + 1,
  }));

  const finalRound = room.roundNumber >= settings.roundCount;
  room.results = {
    summary: `The link was ${state.puzzle.link}`,
    standings,
    winnerIds: standings.filter((entry) => entry.rank === 1).map((entry) => entry.playerId),
    finalRound,
    gameOver: finalRound,
  };
  state.roundsPlayed += 1;
  syncGtlPublicState(room);
  room.phasePrompt = 'The Link Revealed';
  room.phaseSubprompt = `${state.puzzle.link} — did you spot it?`;
}

/**
 * Bots: solve after a random delay with a difficulty-based chance, otherwise
 * send a plausible wrong guess. They never call the AI.
 */
export function simulateGtlBotGuesses(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;
  const settings = readGtlSettings(room);
  const bots = room.players.filter((player) => player.isBot);
  bots.forEach((bot) => {
    const rowId = room.playMode === 'team' && bot.teamId ? bot.teamId : bot.id;
    const row = state.rows.get(rowId);
    if (!row) return;
    const solveChance = [0.35, 0.22, 0.12][state.puzzle.difficulty - 1] ?? 0.2;
    const delay =
      GTL_BOT_MIN_DELAY_MS + Math.random() * (GTL_BOT_MAX_DELAY_MS - GTL_BOT_MIN_DELAY_MS);
    const timeout = setTimeout(() => {
      if (room.gtlState?.phase !== 'guessing') return;
      const correct = Math.random() < solveChance;
      const guess = correct
        ? state.puzzle.link
        : state.puzzle.botWrongGuesses[
            Math.floor(Math.random() * state.puzzle.botWrongGuesses.length)
          ];
      recordGtlGuess(room, bot.id, guess);
    }, delay);
    // Tracked on the room so a phase change cancels them.
    room.botTimeouts.push(timeout);
    void settings;
  });
}

/* Legacy no-op exports kept so the older flow's imports still compile. */
export function recordGtlResponse(..._args: unknown[]): string {
  void _args;
  return '';
}
export function simulateGtlBotResponses(..._args: unknown[]): void {
  void _args;
}
export function finalizeGtlReveal(..._args: unknown[]): void {
  void _args;
}
