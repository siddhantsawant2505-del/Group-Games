/**
 * Top 100 — the dedicated game engine.
 *
 * A round is one hidden ranked list of exactly 100 items. Every player (solo) or
 * every team captain (team mode) types ONE guess; a guess that lands on position
 * N scores N points. The list never leaves this process: clients only ever get
 * the guesses board and, at results, the 1-10 / 90-100 slices.
 *
 * Phase chain (the generic phases, no new ones):
 *   reveal (question, 8s) → input (guess, timed) → reveal-answers (guesses board
 *   + host overrule + Continue) → results (slices + leaderboard) → next-round…
 *
 * Scoring is delegated to `./top100.match` (pure) and every award goes through
 * `awardPoints()` / `awardTeamPoints()`.
 */

import {
  DEFAULT_TOP100_SETTINGS,
  PlayerResultStanding,
  Team,
  Top100DuplicatePolicy,
  Top100GuessRow,
  Top100List,
  Top100PublicState,
  Top100Region,
  Top100Settings,
  Top100Suggestion,
  TOP100_SETTINGS_LIMITS,
  TOP100_TEAM_MIN_GUESS_SECONDS,
} from '../../shared/types';
import { InternalRoom, InternalPlayer } from '../roomManager';
import { awardPoints, awardTeamPoints } from '../scoring';
import {
  TOP100_NO_ANSWER_LABEL,
  Top100GuessInput,
  Top100ScoredGuess,
  buildTop100Slices,
  normalizeTop100Text,
  sanitizeTop100Guess,
  scoreTop100Round,
} from './top100.match';
import { logUnmatchedGuesses } from './top100UnmatchedLog';

/** The question beat: long enough to read the metric and the scoring line. */
export const TOP100_QUESTION_SECONDS = 8;

/** Host window on the guesses board (overrule + Continue). */
export const TOP100_OVERRULE_SECONDS = 90;

/** Team suggestions are short and rate-limited per member, per round. */
export const TOP100_MAX_SUGGESTION_CHARS = 30;
export const TOP100_MAX_SUGGESTIONS_PER_MEMBER = 5;

/** How often a bot guesses something that is not on the list at all. */
export const TOP100_BOT_OFF_LIST_CHANCE = 0.15;

/** Off-list phrases bots use (never on any shipped list). */
const TOP100_BOT_OFF_LIST_GUESSES = [
  'Something random',
  'Fidget spinner',
  'Banana bread',
  'My left shoe',
  'Whatever',
  'Pineapple pizza',
];

export interface Top100HistoryEntry {
  listId: string;
  question: string;
  category: string;
  region: Top100Region;
}

export interface Top100RoundState {
  list: Top100List;
  /** Effective settings captured when the round started. */
  settings: Top100Settings;
  /** Solo: settings.guessSeconds. Team: at least TOP100_TEAM_MIN_GUESS_SECONDS. */
  guessSeconds: number;
  roundNumber: number;
  roundCount: number;
  /** rowId → the locked guess. */
  guesses: Map<string, string>;
  /** teamId → the captain who types this round (team mode only). */
  captains: Map<string, string>;
  /** teamId → where the captain rotation is (kept across rounds). */
  captainCursor: Map<string, number>;
  /** teamId → suggestions this round, in arrival order. */
  suggestions: Map<string, Top100Suggestion[]>;
  /** playerId → suggestions sent this round. */
  suggestionCounts: Map<string, number>;
  /** rowId → host overrule (a forced rank, or null for "not on the list"). */
  overrules: Map<string, number | null>;
  /** True once the guesses board may be shown (every row has a final text). */
  guessesRevealed: boolean;
  /** True once points were awarded for this round. */
  applied: boolean;
  /** The board as it is shown to everyone. */
  rows: Top100GuessRow[];
  /** rowId → points this round. */
  roundPoints: Map<string, number>;
  /** rowId → rounds won outright (ties share a win). */
  roundWins: Map<string, number>;
  gameOver: boolean;
  history: Top100HistoryEntry[];
}

interface Top100Owner {
  /** playerId (solo) or teamId (team mode). */
  rowId: string;
  ownerId: string;
  name: string;
  colorIndex: number;
  teamId?: string;
  teamName?: string;
  isTeam: boolean;
}

const activeRounds = new Map<string, Top100RoundState>();

export function getTop100Round(roomCode: string): Top100RoundState | undefined {
  return activeRounds.get(roomCode);
}

export function cleanupTop100Round(roomCode: string): void {
  activeRounds.delete(roomCode);
}

/* ─────────────────────────────── Settings ─────────────────────────────────── */

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** The room's Top 100 settings, clamped into their legal ranges. */
export function readTop100Settings(room: InternalRoom): Top100Settings {
  const raw = room.gameSettings?.top100 ?? DEFAULT_TOP100_SETTINGS;
  return {
    roundCount: clampInt(
      raw?.roundCount,
      TOP100_SETTINGS_LIMITS.roundCount.min,
      TOP100_SETTINGS_LIMITS.roundCount.max,
      DEFAULT_TOP100_SETTINGS.roundCount
    ),
    guessSeconds: clampInt(
      raw?.guessSeconds,
      TOP100_SETTINGS_LIMITS.guessSeconds.min,
      TOP100_SETTINGS_LIMITS.guessSeconds.max,
      DEFAULT_TOP100_SETTINGS.guessSeconds
    ),
    duplicatePolicy: raw?.duplicatePolicy === 'zero' ? 'zero' : 'allow',
    region:
      raw?.region === 'global' || raw?.region === 'india' ? raw.region : 'mixed',
    categories: Array.isArray(raw?.categories) ? raw.categories.map(String) : [],
  };
}

/**
 * A team has to read its suggestions before locking, so team mode never runs
 * shorter than TOP100_TEAM_MIN_GUESS_SECONDS (default: 60s).
 */
export function effectiveTop100GuessSeconds(settings: Top100Settings, playMode: string): number {
  return playMode === 'team'
    ? Math.max(TOP100_TEAM_MIN_GUESS_SECONDS, settings.guessSeconds)
    : settings.guessSeconds;
}

/* ──────────────────────────── Round scaffolding ───────────────────────────── */

/** Solo: every player owes a guess. Team: one guess per team, by its captain. */
function ownersFor(room: InternalRoom, state: Pick<Top100RoundState, 'captains'>): Top100Owner[] {
  if (room.playMode === 'team' && room.teams.length > 0) {
    return room.teams.map((team) => {
      const members = room.players.filter((player) => player.teamId === team.id);
      const captainId = state.captains.get(team.id) ?? members[0]?.id ?? '';
      const captain = members.find((player) => player.id === captainId);
      return {
        rowId: team.id,
        ownerId: captainId,
        name: team.name,
        colorIndex: captain?.colorIndex ?? team.accentIndex,
        teamId: team.id,
        teamName: team.name,
        isTeam: true,
      };
    });
  }

  return room.players.map((player) => ({
    rowId: player.id,
    ownerId: player.id,
    name: player.name,
    colorIndex: player.colorIndex,
    isTeam: false,
  }));
}

/** Picks this round's captain for every team, rotating through the members. */
function rotateCaptains(room: InternalRoom, previous?: Top100RoundState): Map<string, string> {
  const captains = new Map<string, string>();
  room.teams.forEach((team: Team) => {
    const members = room.players.filter((player) => player.teamId === team.id);
    if (members.length === 0) return;
    const cursor = previous?.captainCursor.get(team.id) ?? 0;
    captains.set(team.id, members[cursor % members.length].id);
  });
  return captains;
}

/**
 * Starts a round: stores the (secret) list, builds the guess rows, rotates the
 * team captains and publishes the question. The list is never mirrored into
 * public state — only its id, question, category and as-of date.
 */
export function setupTop100Round(room: InternalRoom, list: Top100List): Top100RoundState {
  const previous = activeRounds.get(room.code);
  const settings = readTop100Settings(room);
  const roundNumber = Math.min(
    Math.max(1, room.roundNumber || 1),
    settings.roundCount
  );

  // Rotate from the *previous* round's cursor so everybody captains in turn.
  const captains = rotateCaptains(room, previous);

  const state: Top100RoundState = {
    list,
    settings,
    guessSeconds: effectiveTop100GuessSeconds(settings, room.playMode),
    roundNumber,
    roundCount: settings.roundCount,
    guesses: new Map(),
    captains,
    captainCursor: new Map(
      [...captains.entries()].map(([teamId, captainId]) => {
        const members = room.players.filter((player) => player.teamId === teamId);
        const index = members.findIndex((player) => player.id === captainId);
        return [teamId, index < 0 ? 0 : index + 1];
      })
    ),
    suggestions: new Map(),
    suggestionCounts: new Map(),
    overrules: new Map(),
    guessesRevealed: false,
    applied: false,
    rows: [],
    roundPoints: previous?.roundPoints ?? new Map(),
    roundWins: previous?.roundWins ?? new Map(),
    gameOver: false,
    history: previous?.history ?? [],
  };

  activeRounds.set(room.code, state);

  // The generic round counter mirrors this game's own round count so the phase
  // header stays honest.
  room.roundNumber = state.roundNumber;
  room.totalRounds = state.roundCount;
  room.hasSubmittedInput.clear();
  room.privateData = {};

  syncTop100PublicState(room, state);
  syncTop100PrivateState(room, state);
  return state;
}

/* ─────────────────────────────── Public state ─────────────────────────────── */

/** Builds the board: provisional while the host may still overrule, final after. */
function buildTop100Rows(room: InternalRoom, state: Top100RoundState): Top100GuessRow[] {
  const owners = ownersFor(room, state);
  const inputs: Top100GuessInput[] = owners.map((owner) => ({
    rowId: owner.rowId,
    text: state.guesses.get(owner.rowId) ?? TOP100_NO_ANSWER_LABEL,
  }));

  const overrules: Record<string, number | null> = {};
  state.overrules.forEach((value, rowId) => {
    overrules[rowId] = value;
  });

  const scored = scoreTop100Round(state.list, inputs, state.settings.duplicatePolicy, overrules);

  return owners.map((owner, index) => {
    const result: Top100ScoredGuess = scored[index];
    const text = inputs[index].text;
    return {
      rowId: owner.rowId,
      ownerId: owner.ownerId,
      name: owner.name,
      colorIndex: owner.colorIndex,
      ...(owner.teamName ? { teamName: owner.teamName } : {}),
      text,
      submitted: state.guesses.has(owner.rowId),
      matchedRank: result.matchedRank,
      matchedName: result.matchedName,
      points: result.points,
      duplicate: result.duplicate,
      overruled: result.overruled,
    };
  });
}

/** Mirrors the round onto the room's public state (never the list itself). */
export function syncTop100PublicState(room: InternalRoom, state?: Top100RoundState): void {
  const active = state ?? activeRounds.get(room.code);
  if (!active) {
    room.top100State = null;
    return;
  }

  const owners = ownersFor(room, active);
  const showBoard = active.guessesRevealed;
  const rows = showBoard ? active.rows.length > 0 ? active.rows : buildTop100Rows(room, active) : [];

  const publicState: Top100PublicState = {
    listId: active.list.id,
    question: active.list.question,
    category: active.list.category,
    asOf: active.list.asOf,
    roundNumber: active.roundNumber,
    roundCount: active.roundCount,
    guessSeconds: active.guessSeconds,
    duplicatePolicy: active.settings.duplicatePolicy,
    region: active.settings.region,
    guesserIds: owners.map((owner) => owner.rowId),
    submittedIds: showBoard
      ? owners.map((owner) => owner.rowId)
      : owners.filter((owner) => active.guesses.has(owner.rowId)).map((owner) => owner.rowId),
    captains: Object.fromEntries(active.captains.entries()),
    guesses: rows,
    revealed: active.applied,
    ...(active.applied ? { slices: buildTop100Slices(active.list) } : {}),
    finalRound: active.roundNumber >= active.roundCount,
    gameOver: active.gameOver,
  };

  room.top100State = publicState;
}

/* ─────────────────────────────── Private state ────────────────────────────── */

/** The team a player answers for, if any. */
function teamOf(room: InternalRoom, player: InternalPlayer): Team | undefined {
  return player.teamId ? room.teams.find((team) => team.id === player.teamId) : undefined;
}

/**
 * Writes each player's private slice of the round: their own (or their team's)
 * locked guess, whether they are the captain, and — for team members only —
 * their team's suggestions. Suggestions never leave the team.
 */
export function syncTop100PrivateState(room: InternalRoom, state?: Top100RoundState): void {
  const active = state ?? activeRounds.get(room.code);
  if (!active) return;

  room.players.forEach((player) => {
    if (!room.privateData[player.id]) room.privateData[player.id] = {};
    const priv = room.privateData[player.id];
    const team = teamOf(room, player);
    const isTeamMode = room.playMode === 'team' && Boolean(team);

    if (!isTeamMode) {
      const locked = active.guesses.get(player.id);
      priv.top100GuessSubmitted = Boolean(locked);
      priv.top100GuessText = locked || '';
      priv.top100IsCaptain = true;
      priv.top100CaptainName = player.name;
      priv.top100TeamNames = [];
      priv.top100Suggestions = [];
      priv.top100SuggestionsLeft = 0;
    } else if (team) {
      const captainId = active.captains.get(team.id) ?? '';
      const isCaptain = captainId === player.id;
      const locked = active.guesses.get(team.id);
      const captain = room.players.find((candidate) => candidate.id === captainId);
      priv.top100GuessSubmitted = Boolean(locked);
      priv.top100GuessText = locked || '';
      priv.top100IsCaptain = isCaptain;
      priv.top100CaptainName = captain?.name ?? '';
      priv.top100TeamNames = room.players
        .filter((candidate) => candidate.teamId === team.id && candidate.id !== player.id)
        .map((candidate) => candidate.name);
      priv.top100Suggestions = active.suggestions.get(team.id) ?? [];
      priv.top100SuggestionsLeft = Math.max(
        0,
        TOP100_MAX_SUGGESTIONS_PER_MEMBER - (active.suggestionCounts.get(player.id) ?? 0)
      );
    }

    // Results land on the player's own row (solo) or their team's row (team).
    const rowId = isTeamMode && team ? team.id : player.id;
    if (active.applied) {
      const row = active.rows.find((candidate) => candidate.rowId === rowId);
      priv.top100MatchedRank = row ? row.matchedRank : null;
      priv.top100PointsAwarded = row?.points ?? 0;
    } else {
      priv.top100MatchedRank = undefined;
      priv.top100PointsAwarded = undefined;
    }
  });
}

/* ──────────────────────────────── Guesses ─────────────────────────────────── */

/**
 * Locks a guess. Solo: the player's own row. Team: only the current captain may
 * lock the team's guess. A locked guess cannot be changed.
 */
export function recordTop100Guess(
  room: InternalRoom,
  playerId: string,
  raw: string
): { accepted: boolean; error?: string } {
  const state = activeRounds.get(room.code);
  if (!state) return { accepted: false, error: 'No active round.' };

  const owners = ownersFor(room, state);
  const owner = owners.find((candidate) => candidate.ownerId === playerId);
  if (!owner) return { accepted: false, error: 'You are not playing this round.' };

  if (state.guesses.has(owner.rowId)) {
    return { accepted: false, error: 'Your guess is already locked in.' };
  }

  const text = sanitizeTop100Guess(raw);
  state.guesses.set(owner.rowId, text || TOP100_NO_ANSWER_LABEL);
  room.hasSubmittedInput.add(owner.rowId);
  room.hasSubmittedInput.add(playerId);

  syncTop100PublicState(room, state);
  syncTop100PrivateState(room, state);
  return { accepted: true };
}

/** Locks a guess on a specific row (bots, timeouts and tests). */
export function lockTop100Row(
  room: InternalRoom,
  rowId: string,
  raw: string
): { accepted: boolean; error?: string } {
  const state = activeRounds.get(room.code);
  if (!state) return { accepted: false, error: 'No active round.' };
  if (state.guesses.has(rowId)) return { accepted: false, error: 'Already locked in.' };
  const text = sanitizeTop100Guess(raw);
  state.guesses.set(rowId, text || TOP100_NO_ANSWER_LABEL);
  syncTop100PublicState(room, state);
  return { accepted: true };
}

/** Rows that still owe a guess, restricted to players who can actually act. */
export function pendingTop100Guessers(room: InternalRoom): string[] {
  const state = activeRounds.get(room.code);
  if (!state) return [];

  return ownersFor(room, state)
    .filter((owner) => {
      if (state.guesses.has(owner.rowId)) return false;
      const actor = room.players.find((player) => player.id === owner.ownerId);
      return Boolean(actor && (actor.connected || actor.isBot));
    })
    .map((owner) => owner.rowId);
}

/**
 * Team suggestion: short free text that only the captain's teammates see. Capped
 * at 30 characters and five suggestions per member per round.
 */
export function addTop100Suggestion(
  room: InternalRoom,
  playerId: string,
  raw: string
): { accepted: boolean; error?: string; suggestion?: Top100Suggestion } {
  const state = activeRounds.get(room.code);
  if (!state) return { accepted: false, error: 'No active round.' };
  if (room.playMode !== 'team') return { accepted: false, error: 'Suggestions are a team-mode thing.' };

  const player = room.players.find((candidate) => candidate.id === playerId);
  const team = player ? teamOf(room, player) : undefined;
  if (!player || !team) return { accepted: false, error: 'Join a team first.' };

  const used = state.suggestionCounts.get(playerId) ?? 0;
  if (used >= TOP100_MAX_SUGGESTIONS_PER_MEMBER) {
    return { accepted: false, error: 'That is all your suggestions for this round.' };
  }

  const text = String(raw ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TOP100_MAX_SUGGESTION_CHARS);
  if (!text) return { accepted: false, error: 'Type a suggestion first.' };

  const list = state.suggestions.get(team.id) ?? [];
  const suggestion: Top100Suggestion = {
    playerId,
    playerName: player.name,
    colorIndex: player.colorIndex,
    text,
    sequence: list.length + 1,
  };
  state.suggestions.set(team.id, [...list, suggestion]);
  state.suggestionCounts.set(playerId, used + 1);

  syncTop100PrivateState(room, state);
  return { accepted: true, suggestion };
}

/** This team's suggestions (server-side view; trusted callers only). */
export function teamSuggestions(roomCode: string, teamId: string): Top100Suggestion[] {
  return activeRounds.get(roomCode)?.suggestions.get(teamId) ?? [];
}

/** The host's overrule for a row: a forced rank, or null for "not on the list". */
export function setTop100Overrule(
  room: InternalRoom,
  rowId: string,
  value: number | null
): { success: boolean; error?: string } {
  const state = activeRounds.get(room.code);
  if (!state) return { success: false, error: 'No active round.' };
  if (state.applied) return { success: false, error: 'Points are already final.' };

  const owners = ownersFor(room, state);
  if (!owners.some((owner) => owner.rowId === rowId)) {
    return { success: false, error: 'Unknown guess.' };
  }

  if (value === null) {
    state.overrules.set(rowId, null);
  } else {
    const rank = Math.round(Number(value));
    if (!Number.isFinite(rank) || rank < 1 || rank > 100) {
      return { success: false, error: 'Pick a position between 1 and 100.' };
    }
    state.overrules.set(rowId, rank);
  }

  state.rows = buildTop100Rows(room, state);
  syncTop100PublicState(room, state);
  return { success: true };
}

/**
 * Fills in the rows that never locked a guess (a team falls back to its most
 * recent suggestion), then opens the guesses board.
 */
export function finalizeTop100Guesses(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  ownersFor(room, state).forEach((owner) => {
    if (state.guesses.has(owner.rowId)) return;
    if (owner.isTeam && owner.teamId) {
      const suggestions = state.suggestions.get(owner.teamId) ?? [];
      const last = suggestions.length > 0 ? suggestions[suggestions.length - 1].text : '';
      state.guesses.set(owner.rowId, last || TOP100_NO_ANSWER_LABEL);
      return;
    }
    state.guesses.set(owner.rowId, TOP100_NO_ANSWER_LABEL);
  });

  state.guessesRevealed = true;
  state.rows = buildTop100Rows(room, state);
  syncTop100PublicState(room, state);
  syncTop100PrivateState(room, state);
}

/* ───────────────────────────────── Scoring ────────────────────────────────── */

/**
 * Applies the round's points (host overrules included) via awardPoints() in solo
 * mode and awardTeamPoints() in team mode. Idempotent: a second call is a no-op.
 */
export function applyTop100Scores(room: InternalRoom): { gameOver: boolean; rows: Top100GuessRow[] } {
  const state = activeRounds.get(room.code);
  if (!state) return { gameOver: false, rows: [] };

  if (state.applied) return { gameOver: state.gameOver, rows: state.rows };

  const rows = buildTop100Rows(room, state);
  const teamMode = room.playMode === 'team' && room.teams.length > 0;

  rows.forEach((row) => {
    if (teamMode) {
      awardTeamPoints(room, row.rowId, row.points, `top100:round${state.roundNumber}`);
    } else {
      awardPoints(room, row.ownerId, row.points, `top100:round${state.roundNumber}`);
    }
  });

  state.roundPoints = new Map(rows.map((row) => [row.rowId, row.points]));
  const best = rows.reduce((max, row) => Math.max(max, row.points), 0);
  if (best > 0) {
    rows
      .filter((row) => row.points === best)
      .forEach((row) => state.roundWins.set(row.rowId, (state.roundWins.get(row.rowId) ?? 0) + 1));
  }

  state.rows = rows;
  state.applied = true;
  state.gameOver = state.roundNumber >= state.roundCount;
  state.history = [
    ...state.history,
    {
      listId: state.list.id,
      question: state.list.question,
      category: state.list.category,
      region: state.list.region,
    },
  ];

  // Content maintenance: guesses that matched nothing, without any identity.
  logUnmatchedGuesses(
    state.list.id,
    rows.filter((row) => row.matchedRank === null).map((row) => normalizeTop100Text(row.text))
  );

  syncTop100PublicState(room, state);
  syncTop100PrivateState(room, state);
  return { gameOver: state.gameOver, rows };
}

function rankStandings(standings: PlayerResultStanding[]): PlayerResultStanding[] {
  const sorted = [...standings].sort((a, b) => b.totalScore - a.totalScore);
  sorted.forEach((entry, index) => {
    // Ties share a rank: the same total means the same place.
    entry.rank = index > 0 && sorted[index - 1].totalScore === entry.totalScore
      ? sorted[index - 1].rank
      : index + 1;
  });
  return sorted;
}

/**
 * Writes the round's results (the 1-10 / 90-100 slices, who scored what, and the
 * running standings). `final` marks the last round, whose screen is the final
 * standings instead of a "next round" prompt.
 */
export function buildTop100Results(room: InternalRoom, options: { final: boolean }): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  const teamMode = room.playMode === 'team' && room.teams.length > 0;
  const rows = state.rows;

  const standings: PlayerResultStanding[] = room.players.map((player) => {
    const rowId = teamMode ? player.teamId ?? '' : player.id;
    const points = state.roundPoints.get(rowId) ?? 0;
    const team = teamMode ? room.teams.find((candidate) => candidate.id === rowId) : undefined;
    const isCaptain =
      teamMode && state.captains.get(team?.id ?? '') === player.id;
    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      pointsAdded: teamMode ? 0 : points,
      totalScore: player.score,
      badge: teamMode ? (isCaptain ? 'Captain' : undefined) : points > 0 ? `+${points}` : undefined,
    };
  });

  const ranked = rankStandings(standings);

  // Round winner names (only rows that actually scored).
  const bestPoints = rows.reduce((max, row) => Math.max(max, row.points), 0);
  const roundWinnerNames =
    bestPoints > 0 ? rows.filter((row) => row.points === bestPoints).map((row) => row.name) : [];
  const matchedCount = rows.filter((row) => row.matchedRank !== null).length;

  let winnerTitle: string;
  if (!options.final) {
    winnerTitle = bestPoints > 0 ? `Round ${state.roundNumber}: ${roundWinnerNames.join(' & ')}` : `Round ${state.roundNumber}: nobody scored`;
  } else if (teamMode) {
    const teamTotals = [...room.teams]
      .map((team) => ({ name: team.name, total: team.score }))
      .sort((a, b) => b.total - a.total);
    const top = teamTotals[0]?.total ?? 0;
    const winners = teamTotals.filter((team) => team.total === top).map((team) => team.name);
    winnerTitle = winners.length > 1 ? `${winners.join(' & ')} tie for first!` : `${winners[0] ?? 'Nobody'} wins!`;
  } else {
    const top = ranked[0]?.totalScore ?? 0;
    const winners = ranked.filter((entry) => entry.totalScore === top).map((entry) => entry.playerName);
    winnerTitle = winners.length > 1 ? `${winners.join(' & ')} tie for first!` : `${winners[0] ?? 'Nobody'} wins!`;
  }

  const summary = options.final
    ? `${state.roundCount} rounds played — ${matchedCount} of ${rows.length} guesses landed on the list this round.`
    : `${matchedCount} of ${rows.length} guesses were on the list${
        bestPoints > 0 ? `; the deepest was ${bestPoints} points` : ''
      }.`;

  room.results = {
    summary,
    winnerTitle,
    category: state.list.category,
    top100Question: state.list.question,
    top100Category: state.list.category,
    top100AsOf: state.list.asOf,
    top100Source: state.list.source,
    top100Slices: buildTop100Slices(state.list),
    top100Unmatched: rows
      .filter((row) => row.matchedRank === null)
      .map((row) => row.text)
      .filter((text) => text !== TOP100_NO_ANSWER_LABEL),
    top100IsFinal: options.final,
    top100RoundsPlayed: state.history.length,
    top100RoundWinnerNames: roundWinnerNames,
    standings: ranked,
  };
}

/* ───────────────────────────────── Bots ───────────────────────────────────── */

/**
 * A bot guess: usually a real list item, weighted towards the easier half of the
 * board (ranks 1-60 score less, so bots stay beatable), and occasionally
 * something that is not on the list at all.
 */
export function pickTop100BotGuess(list: Top100List): string {
  if (Math.random() < TOP100_BOT_OFF_LIST_CHANCE) {
    const phrase = TOP100_BOT_OFF_LIST_GUESSES[
      Math.floor(Math.random() * TOP100_BOT_OFF_LIST_GUESSES.length)
    ];
    return phrase;
  }

  const sorted = [...list.items].sort((a, b) => a.rank - b.rank);
  const weights = sorted.map((item) => (item.rank <= 60 ? 61 - item.rank : 4));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  let picked = sorted[0];
  for (let i = 0; i < sorted.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      picked = sorted[i];
      break;
    }
  }

  // Sometimes answer with an alias, the way a real player might.
  if (picked.aliases.length > 0 && Math.random() < 0.4) {
    return picked.aliases[Math.floor(Math.random() * picked.aliases.length)];
  }
  return picked.name;
}

/** Every bot that owes a guess locks one (solo players and team captains). */
export function simulateTop100BotGuesses(room: InternalRoom): string[] {
  const state = activeRounds.get(room.code);
  if (!state) return [];

  const locked: string[] = [];
  pendingTop100Guessers(room).forEach((rowId) => {
    const owner = ownersFor(room, state).find((candidate) => candidate.rowId === rowId);
    const player = room.players.find((candidate) => candidate.id === owner?.ownerId);
    if (!player?.isBot) return;
    const outcome = lockTop100Row(room, rowId, pickTop100BotGuess(state.list));
    if (outcome.accepted) locked.push(rowId);
  });
  return locked;
}

/** Bot teammates chip in with a suggestion so a human captain has something to read. */
export function simulateTop100BotSuggestions(room: InternalRoom): number {
  const state = activeRounds.get(room.code);
  if (!state || room.playMode !== 'team') return 0;

  let added = 0;
  room.players
    .filter((player) => player.isBot && player.teamId)
    .forEach((bot) => {
      const teamId = bot.teamId as string;
      // The captain does not suggest to itself.
      if (state.captains.get(teamId) === bot.id) return;
      const outcome = addTop100Suggestion(room, bot.id, pickTop100BotGuess(state.list));
      if (outcome.accepted) added += 1;
    });
  return added;
}
