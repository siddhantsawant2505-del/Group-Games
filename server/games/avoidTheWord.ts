/**
 * Avoid the Word — dedicated engine (elimination rules).
 *
 * One round: the server picks an anchor, the anchor answers a hidden question,
 * then every other alive player answers the SAME question on their own turn. An
 * answer that matches the anchor's eliminates that player at the end of the
 * round; everyone else is safe. The last player standing wins.
 *
 * Everything here is server-side only. The anchor's answer, and every answer,
 * live in this module's per-room state until the round reveal; the round's
 * question only ever reaches the player whose input is open, through
 * `player:private-state`.
 *
 * Phase chain (scoped to this game): reveal -> avoid-anchor -> avoid-turn
 * (repeats) -> avoid-reveal -> results (or the next round).
 */

import {
  AVOID_SETTINGS_LIMITS,
  AvoidAnswerRow,
  AvoidEliminationRound,
  AvoidPlayerStatus,
  AvoidPlacement,
  AvoidPublicState,
  AvoidQuestion,
  AvoidSettings,
  AvoidTurnStatus,
  DEFAULT_AVOID_SETTINGS,
  PlayerResultStanding,
} from '../../shared/types';
import { InternalRoom } from '../roomManager';
import { awardPoints } from '../scoring';
import { shuffle } from '../content/contentBag';
import {
  NO_ANSWER_LABEL,
  answerMatchesQuestion,
  cleanAnswerText,
  parseNumberAnswer,
  sanitizeTextAnswer,
} from './avoidTheWord.match';

/* ───────────────────────────── tunable constants ─────────────────────────── */

export const ATW_ANCHOR_SECONDS = DEFAULT_AVOID_SETTINGS.anchorSeconds;
export const ATW_TURN_SECONDS = DEFAULT_AVOID_SETTINGS.turnSeconds;
export const ATW_ROUND_CAP = DEFAULT_AVOID_SETTINGS.roundCap;

/** The anchor scores this for every player who matched them. */
export const ATW_POINTS_PER_MATCH = 1;
/** Every winner (player, or alive member of a winning team) scores this. */
export const ATW_WINNER_POINTS = 3;
/** Consecutive skipped turns before a player is eliminated as AFK. */
export const ATW_MAX_SKIPS = 2;
/** Smallest table the game can run with. */
export const ATW_MIN_PLAYERS = 3;

/** Host-editable bounds, enforced by the room manager and mirrored in the UI. */
export const ATW_SETTINGS_LIMITS = AVOID_SETTINGS_LIMITS;

/* ─────────────────────────────── round state ─────────────────────────────── */

interface AvoidAnswer {
  /** Canonical value used for comparison (text, option, number, player id). */
  value: string;
  /** What the reveal shows. */
  display: string;
  answeredPlayerId?: string;
  answeredPlayerName?: string;
  skipped: boolean;
}

export interface AvoidRoundState {
  roundNumber: number;
  /** Questions played this game — drives the round cap. */
  roundsPlayed: number;
  question: AvoidQuestion;
  anchorId: string;
  anchorAnswer: AvoidAnswer | null;
  answers: Record<string, AvoidAnswer>;
  /** Alive non-anchor players, randomized for this round. */
  turnOrder: string[];
  turnIndex: number;
  statuses: Record<string, AvoidTurnStatus>;
  skippedStreak: Record<string, number>;
  matchedIds: string[];
  lastMatchedId: string;
  overrules: Record<string, boolean>;
  alive: Set<string>;
  eliminations: AvoidEliminationRound[];
  /** Anchor rotation: a queue of alive ids plus who has anchored this cycle. */
  anchorQueue: string[];
  anchoredThisCycle: Set<string>;
  lastAnchorId: string;
  gameOver: boolean;
  winnersAwarded: boolean;
  winnerPlayerIds: string[];
  winnerTeamIds: string[];
  roundPoints: Record<string, number>;
}

const activeRounds = new Map<string, AvoidRoundState>();

export function getAvoidRound(roomCode: string): AvoidRoundState | undefined {
  return activeRounds.get(roomCode);
}

export function cleanupAvoidTheWordRound(roomCode: string): void {
  activeRounds.delete(roomCode);
}

/** Public settings with every field clamped into its legal range. */
export function readAvoidSettings(room: InternalRoom): AvoidSettings {
  const raw = room.gameSettings?.avoidTheWord || DEFAULT_AVOID_SETTINGS;
  const clamp = (value: unknown, min: number, max: number, fallback: number) => {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };
  return {
    anchorSeconds: clamp(
      raw.anchorSeconds,
      ATW_SETTINGS_LIMITS.anchorSeconds.min,
      ATW_SETTINGS_LIMITS.anchorSeconds.max,
      ATW_ANCHOR_SECONDS
    ),
    turnSeconds: clamp(
      raw.turnSeconds,
      ATW_SETTINGS_LIMITS.turnSeconds.min,
      ATW_SETTINGS_LIMITS.turnSeconds.max,
      ATW_TURN_SECONDS
    ),
    roundCap: clamp(
      raw.roundCap,
      ATW_SETTINGS_LIMITS.roundCap.min,
      ATW_SETTINGS_LIMITS.roundCap.max,
      ATW_ROUND_CAP
    ),
    tone: raw.tone === 'spicy' ? 'spicy' : 'clean',
  };
}

/* ────────────────────────────── anchor picking ───────────────────────────── */

/**
 * Anchor rotation: a shuffled queue over the alive players, refilled once every
 * alive player has anchored (so nobody anchors twice before everyone has). The
 * previous anchor is kept out of the front of a fresh queue when there is a
 * choice, so the same player never anchors two rounds in a row at small tables.
 */
export function pickAnchorId(state: AvoidRoundState, aliveIds: string[]): string {
  if (aliveIds.length === 0) return '';
  if (aliveIds.length === 1) return aliveIds[0];

  // Drop ids that are no longer alive and refill when the cycle is exhausted.
  state.anchorQueue = state.anchorQueue.filter((id) => aliveIds.includes(id));
  const remainingCycle = aliveIds.filter((id) => !state.anchoredThisCycle.has(id));
  if (state.anchorQueue.length === 0) {
    if (remainingCycle.length === 0) {
      // Everybody alive has anchored: start a new cycle.
      state.anchoredThisCycle.clear();
      remainingCycle.push(...aliveIds.filter((id) => id !== state.lastAnchorId));
      if (remainingCycle.length === 0) remainingCycle.push(...aliveIds);
    }
    state.anchorQueue = shuffle(remainingCycle);
  }

  const anchorId = state.anchorQueue.shift() as string;
  state.anchoredThisCycle.add(anchorId);
  state.lastAnchorId = anchorId;
  return anchorId;
}

/* ─────────────────────────────── round setup ─────────────────────────────── */

function aliveIdsOf(state: AvoidRoundState): string[] {
  return [...state.alive];
}

/** Alive players that are still connected, or everyone alive as a fallback. */
function answerableAliveIds(room: InternalRoom, state: AvoidRoundState): string[] {
  const connected = room.players
    .filter((player) => state.alive.has(player.id) && (player.connected || player.isBot))
    .map((player) => player.id);
  return connected.length > 0 ? connected : aliveIdsOf(state);
}

export interface AvoidRoundInfo {
  anchorId: string;
  anchorName: string;
  roundNumber: number;
  turnOrder: string[];
}

/**
 * 1. Round setup: a fresh anchor (from the rotation) and a fresh question. The
 * private state is (re)built for everyone; nobody but the anchor will see the
 * question, and only once the anchor phase starts.
 */
export function setupAvoidRound(
  room: InternalRoom,
  question: AvoidQuestion,
  options: { alive?: Iterable<string>; previousState?: AvoidRoundState } = {}
): AvoidRoundInfo {
  const previous = options.previousState;
  const alive = new Set<string>(
    options.alive ? [...options.alive] : room.players.map((player) => player.id)
  );

  const state: AvoidRoundState = {
    roundNumber: room.roundNumber,
    roundsPlayed: previous ? previous.roundsPlayed + 1 : 1,
    question,
    anchorId: '',
    anchorAnswer: null,
    answers: {},
    turnOrder: [],
    turnIndex: 0,
    statuses: {},
    skippedStreak: {},
    matchedIds: [],
    lastMatchedId: '',
    overrules: {},
    alive,
    eliminations: previous ? previous.eliminations : [],
    anchorQueue: previous ? [...previous.anchorQueue] : [],
    anchoredThisCycle: previous ? new Set(previous.anchoredThisCycle) : new Set<string>(),
    lastAnchorId: previous ? previous.lastAnchorId : '',
    gameOver: false,
    winnersAwarded: false,
    winnerPlayerIds: [],
    winnerTeamIds: [],
    roundPoints: previous ? { ...previous.roundPoints } : {},
  };

  const aliveIds = aliveIdsOf(state);
  state.anchorId = pickAnchorId(state, aliveIds);
  state.turnOrder = shuffle(aliveIds.filter((id) => id !== state.anchorId));

  room.players.forEach((player) => {
    state.statuses[player.id] = alive.has(player.id) ? 'waiting' : 'eliminated';
    state.skippedStreak[player.id] = previous?.skippedStreak[player.id] ?? 0;
    if (!alive.has(player.id)) state.skippedStreak[player.id] = 0;
  });

  activeRounds.set(room.code, state);
  room.privateData = {};
  // The reveal phase is the anchor's private briefing: they read the question
  // (and the hint) before their answer window opens. Nobody else gets it.
  writePrivateState(room, state, 'reveal', state.anchorId);
  room.avoidState = buildPublicState(room, state, { phase: 'reveal' });

  return {
    anchorId: state.anchorId,
    anchorName: room.players.find((player) => player.id === state.anchorId)?.name || 'Player',
    roundNumber: state.roundNumber,
    turnOrder: [...state.turnOrder],
  };
}

/**
 * 2. Anchor phase: the anchor privately receives the question (and its input
 * shape). Everyone else keeps seeing only public state.
 */
export function beginAvoidAnchorPhase(room: InternalRoom): { anchorId: string; anchorName: string } | null {
  const state = activeRounds.get(room.code);
  if (!state) return null;
  room.avoidState = buildPublicState(room, state, { phase: 'avoid-anchor' });
  writePrivateState(room, state, 'avoid-anchor', state.anchorId);
  return {
    anchorId: state.anchorId,
    anchorName: room.players.find((player) => player.id === state.anchorId)?.name || 'Player',
  };
}

/** Who answers next, or null once every turn this round has been played. */
export function nextAvoidTurnPlayerId(state: AvoidRoundState): string | null {
  return state.turnOrder[state.turnIndex] ?? null;
}

export function hasMoreAvoidTurns(state: AvoidRoundState): boolean {
  return state.turnIndex < state.turnOrder.length;
}

/**
 * Opens the active player's turn: question in their private state, "your turn"
 * in public state.
 */
export function beginAvoidTurn(
  room: InternalRoom,
  activePlayerId: string
): { playerId: string; playerName: string; turnNumber: number; totalTurns: number } {
  const state = activeRounds.get(room.code) as AvoidRoundState;
  room.avoidState = buildPublicState(room, state, { phase: 'avoid-turn', activePlayerId });
  writePrivateState(room, state, 'avoid-turn', activePlayerId);
  return {
    playerId: activePlayerId,
    playerName: room.players.find((player) => player.id === activePlayerId)?.name || 'Player',
    turnNumber: state.turnIndex + 1,
    totalTurns: state.turnOrder.length,
  };
}

/* ────────────────────────────── answer handling ──────────────────────────── */

export interface AvoidAnswerInput {
  raw: string;
  /** 'player' answers: the tapped player's id. */
  playerId?: string;
}

export interface AvoidAnswerOutcome {
  accepted: boolean;
  matched: boolean;
  reason?: string;
  answer?: AvoidAnswer;
}

/**
 * Turns raw input into the round's canonical answer, validating it against the
 * question's shape. Returns null when the input cannot be accepted at all.
 */
export function normalizeAvoidAnswer(
  room: InternalRoom,
  state: AvoidRoundState,
  input: AvoidAnswerInput
): AvoidAnswer | null {
  const question = state.question;

  if (question.answerType === 'choice') {
    const options = question.choices || [];
    const submitted = cleanAnswerText(input.raw);
    const option = options.find((entry) => entry.toLowerCase() === submitted.toLowerCase());
    if (!option) return null;
    return { value: option, display: option, skipped: false };
  }

  if (question.answerType === 'number') {
    const value = parseNumberAnswer(input.raw);
    if (value === null) return null;
    const range = question.numberRange;
    if (range && (value < range.min || value > range.max)) return null;
    return { value: String(value), display: String(value), skipped: false };
  }

  if (question.answerType === 'player') {
    const targetId = String(input.playerId || input.raw || '').trim();
    const target = room.players.find((player) => player.id === targetId && state.alive.has(player.id));
    if (!target) return null;
    return {
      value: target.id,
      display: target.name,
      answeredPlayerId: target.id,
      answeredPlayerName: target.name,
      skipped: false,
    };
  }

  const text = sanitizeTextAnswer(input.raw);
  if (!text) return null;
  return { value: text, display: text, skipped: false };
}

function anchorCompareValue(state: AvoidRoundState): string | null {
  if (!state.anchorAnswer || state.anchorAnswer.skipped) return null;
  return state.anchorAnswer.value;
}

/**
 * Records an answer for the player whose input is open (anchor or active turn
 * player) and compares it to the anchor's hidden answer straight away.
 */
export function recordAvoidAnswer(
  room: InternalRoom,
  playerId: string,
  input: AvoidAnswerInput,
  phase: 'avoid-anchor' | 'avoid-turn'
): AvoidAnswerOutcome {
  const state = activeRounds.get(room.code);
  if (!state) return { accepted: false, matched: false, reason: 'no round' };

  const isAnchor = phase === 'avoid-anchor' && playerId === state.anchorId;
  const isActiveTurn =
    phase === 'avoid-turn' && playerId === nextAvoidTurnPlayerId(state) && playerId !== state.anchorId;
  if (!isAnchor && !isActiveTurn) return { accepted: false, matched: false, reason: 'not your turn' };
  if (!state.alive.has(playerId)) return { accepted: false, matched: false, reason: 'out of the game' };

  const answer = normalizeAvoidAnswer(room, state, input);
  if (!answer) return { accepted: false, matched: false, reason: 'invalid answer' };

  if (isAnchor) {
    state.anchorAnswer = answer;
    writePrivateState(room, state, phase, playerId);
    room.avoidState = buildPublicState(room, state, { phase, activePlayerId: playerId });
    return { accepted: true, matched: false, answer };
  }

  const compare = anchorCompareValue(state);
  const matched =
    compare !== null && answerMatchesQuestion(state.question, answer.value, compare);

  state.answers[playerId] = answer;
  state.skippedStreak[playerId] = 0;
  state.statuses[playerId] = matched ? 'matched' : 'safe';
  if (matched) {
    state.matchedIds.push(playerId);
    state.lastMatchedId = playerId;
  }

  room.avoidState = buildPublicState(room, state, { phase, activePlayerId: playerId });
  return { accepted: true, matched, answer };
}

/**
 * Timeout / disconnect: records "(no answer)" and marks the turn skipped. Two
 * consecutive skips eliminate the player as AFK (immediately, so the table sees
 * it during the round).
 */
export function recordAvoidSkip(
  room: InternalRoom,
  playerId: string,
  phase: 'avoid-anchor' | 'avoid-turn'
): { skipped: boolean; afkEliminated: boolean } {
  const state = activeRounds.get(room.code);
  if (!state) return { skipped: false, afkEliminated: false };

  const isAnchor = phase === 'avoid-anchor' && playerId === state.anchorId;
  const isActiveTurn = phase === 'avoid-turn' && playerId === nextAvoidTurnPlayerId(state);
  if (!isAnchor && !isActiveTurn) return { skipped: false, afkEliminated: false };

  const skipped: AvoidAnswer = { value: '', display: NO_ANSWER_LABEL, skipped: true };

  if (isAnchor) {
    // The anchor can never be eliminated in their own round.
    state.anchorAnswer = skipped;
    room.avoidState = buildPublicState(room, state, { phase });
    return { skipped: true, afkEliminated: false };
  }

  state.answers[playerId] = skipped;
  state.statuses[playerId] = 'skipped';
  state.skippedStreak[playerId] = (state.skippedStreak[playerId] || 0) + 1;

  let afkEliminated = false;
  if (state.skippedStreak[playerId] >= ATW_MAX_SKIPS && state.alive.has(playerId)) {
    eliminatePlayers(room, state, [playerId]);
    state.skippedStreak[playerId] = 0;
    afkEliminated = true;
  }

  room.avoidState = buildPublicState(room, state, { phase });
  return { skipped: true, afkEliminated };
}

/** True when the player's input is the one currently open. */
export function isAvoidActiveAnswerer(state: AvoidRoundState, playerId: string): boolean {
  return playerId === state.anchorId || playerId === nextAvoidTurnPlayerId(state);
}

/** Advances past the resolved turn; returns the next active player or null. */
export function advanceAvoidTurn(state: AvoidRoundState): string | null {
  state.turnIndex += 1;
  return nextAvoidTurnPlayerId(state);
}

/* ──────────────────────── eliminations, overrule, end ───────────────────── */

function eliminatePlayers(room: InternalRoom, state: AvoidRoundState, playerIds: string[]): void {
  const fresh = playerIds.filter((id) => state.alive.has(id));
  if (fresh.length === 0) return;
  fresh.forEach((id) => {
    state.alive.delete(id);
    state.statuses[id] = 'eliminated';
  });
  state.eliminations.push({ round: state.roundNumber, playerIds: fresh });
}

/** Final matched set for the round: the comparison result, unless overruled. */
export function finalMatchedIds(state: AvoidRoundState): string[] {
  const all = new Set<string>([...state.matchedIds, ...Object.keys(state.overrules)]);
  return [...all].filter((playerId) => {
    if (state.overrules[playerId] !== undefined) return state.overrules[playerId];
    return state.matchedIds.includes(playerId);
  });
}

/** Host overrule for close calls (synonyms, typos, near-misses). */
export function setAvoidOverrule(
  room: InternalRoom,
  playerId: string,
  countAsMatch: boolean
): { success: boolean; error?: string } {
  const state = activeRounds.get(room.code);
  if (!state) return { success: false, error: 'No round in progress.' };
  if (!state.answers[playerId]) {
    return { success: false, error: 'That player has no answer to overrule.' };
  }
  state.overrules[playerId] = countAsMatch;
  room.avoidState = buildPublicState(room, state, { phase: 'avoid-reveal' });
  return { success: true };
}

/**
 * 3. Round reveal: the question, the anchor's answer and every answer become
 * public, with matches highlighted and overrules still open.
 */
export function beginAvoidReveal(room: InternalRoom): AvoidPublicState {
  const state = activeRounds.get(room.code) as AvoidRoundState;
  room.avoidState = buildPublicState(room, state, { phase: 'avoid-reveal' });
  return room.avoidState;
}

/**
 * Applies the round's eliminations, awards the anchor for every player who
 * matched, and works out whether the game is over. Returns the knocked-out ids.
 */
export function applyAvoidEliminations(
  room: InternalRoom,
  settings: AvoidSettings
): { eliminated: string[]; gameOver: boolean; winners: string[] } {
  const state = activeRounds.get(room.code) as AvoidRoundState;
  const matched = finalMatchedIds(state);

  eliminatePlayers(room, state, matched);

  // The anchor scores for picking the answer the group would say.
  if (matched.length > 0) {
    awardPoints(room, state.anchorId, matched.length * ATW_POINTS_PER_MATCH, 'atw:anchor');
    state.roundPoints[state.anchorId] =
      (state.roundPoints[state.anchorId] || 0) + matched.length * ATW_POINTS_PER_MATCH;
  }

  const gameOver = checkAvoidGameOver(room, state, settings);
  room.avoidState = buildPublicState(room, state, { phase: 'avoid-reveal' });
  return { eliminated: matched, gameOver, winners: state.winnerPlayerIds };
}

/**
 * End conditions.
 *  - solo: one player left, or the round cap reached (survivors share the win)
 *  - team: one team with alive members, or the cap (those teams share the win)
 */
export function checkAvoidGameOver(
  room: InternalRoom,
  state: AvoidRoundState,
  settings: AvoidSettings
): boolean {
  if (state.gameOver) return true;

  const aliveIds = [...state.alive];
  const teamMode = room.playMode === 'team' && room.teams.length > 0;

  let finished = false;
  let winners: string[] = [];
  let winnerTeams: string[] = [];

  if (teamMode) {
    const aliveTeams = room.teams.filter((team) =>
      team.memberIds.some((memberId) => state.alive.has(memberId))
    );
    if (aliveTeams.length <= 1) {
      finished = true;
      winnerTeams = aliveTeams.map((team) => team.id);
      winners = aliveIds.filter((playerId) =>
        aliveTeams.some((team) => team.memberIds.includes(playerId))
      );
    }
  } else if (aliveIds.length <= 1) {
    finished = true;
    winners = aliveIds;
  }

  if (!finished && state.roundsPlayed >= settings.roundCap) {
    finished = true;
    winners = aliveIds;
    winnerTeams = teamMode
      ? room.teams
          .filter((team) => team.memberIds.some((memberId) => state.alive.has(memberId)))
          .map((team) => team.id)
      : [];
  }

  if (!finished) return false;

  state.gameOver = true;
  state.winnerPlayerIds = winners;
  state.winnerTeamIds = winnerTeams;

  if (!state.winnersAwarded) {
    state.winnersAwarded = true;
    winners.forEach((playerId) => {
      awardPoints(room, playerId, ATW_WINNER_POINTS, 'atw:winner');
      state.roundPoints[playerId] = (state.roundPoints[playerId] || 0) + ATW_WINNER_POINTS;
    });
  }

  room.avoidState = buildPublicState(room, state, { phase: 'avoid-reveal' });
  return true;
}

/* ─────────────────────────── public / private state ─────────────────────── */

function buildStatuses(room: InternalRoom, state: AvoidRoundState): AvoidPlayerStatus[] {
  const eliminatedRoundOf = (playerId: string): number | null => {
    for (const entry of state.eliminations) {
      if (entry.playerIds.includes(playerId)) return entry.round;
    }
    return null;
  };

  return room.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    colorIndex: player.colorIndex,
    status: state.statuses[player.id] || (state.alive.has(player.id) ? 'waiting' : 'eliminated'),
    skippedStreak: state.skippedStreak[player.id] || 0,
    eliminatedRound: eliminatedRoundOf(player.id),
  }));
}

function buildRows(room: InternalRoom, state: AvoidRoundState): AvoidAnswerRow[] {
  const matched = new Set(finalMatchedIds(state));
  const roundPoints = state.roundPoints;

  const anchorRow: AvoidAnswerRow = {
    playerId: state.anchorId,
    playerName: room.players.find((player) => player.id === state.anchorId)?.name || 'Player',
    colorIndex: room.players.find((player) => player.id === state.anchorId)?.colorIndex ?? 0,
    answer: state.anchorAnswer?.display || NO_ANSWER_LABEL,
    matched: false,
    skipped: Boolean(state.anchorAnswer?.skipped),
    isAnchor: true,
    pointsAdded: 0,
  };

  const rows: AvoidAnswerRow[] = [anchorRow];
  state.turnOrder.forEach((playerId) => {
    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) return;
    const answer = state.answers[playerId];
    const isMatched = matched.has(playerId);
    rows.push({
      playerId,
      playerName: player.name,
      colorIndex: player.colorIndex,
      answer: answer?.display || NO_ANSWER_LABEL,
      ...(answer?.answeredPlayerId ? { answeredPlayerId: answer.answeredPlayerId } : {}),
      ...(answer?.answeredPlayerName ? { answeredPlayerName: answer.answeredPlayerName } : {}),
      matched: isMatched,
      skipped: Boolean(answer?.skipped),
      isAnchor: false,
      pointsAdded: roundPoints[playerId] || 0,
    });
  });

  // Keep the anchor's own points on its row (awards land on Continue).
  rows[0].pointsAdded = roundPoints[state.anchorId] || 0;
  return rows;
}

interface PublicStateOptions {
  phase: 'reveal' | 'avoid-anchor' | 'avoid-turn' | 'avoid-reveal';
  activePlayerId?: string;
}

function buildPublicState(
  room: InternalRoom,
  state: AvoidRoundState,
  options: PublicStateOptions
): AvoidPublicState {
  const settings = readAvoidSettings(room);
  const revealed = options.phase === 'avoid-reveal';
  const activePlayerId =
    options.phase === 'avoid-anchor'
      ? state.anchorId
      : options.phase === 'avoid-turn'
      ? options.activePlayerId || nextAvoidTurnPlayerId(state) || ''
      : '';

  const playerName = (playerId: string) =>
    room.players.find((player) => player.id === playerId)?.name || '';

  return {
    roundNumber: state.roundNumber,
    roundCap: settings.roundCap,
    anchorPlayerId: state.anchorId,
    anchorPlayerName: playerName(state.anchorId),
    activePlayerId,
    activePlayerName: activePlayerId ? playerName(activePlayerId) : '',
    statuses: buildStatuses(room, state),
    alivePlayerIds: [...state.alive],
    aliveCount: state.alive.size,
    turnOrder: [...state.turnOrder],
    turnNumber: Math.min(state.turnIndex + 1, Math.max(1, state.turnOrder.length)),
    totalTurns: state.turnOrder.length,
    matchedPlayerIds: [...state.matchedIds],
    lastMatchedPlayerId: state.lastMatchedId,
    answerType: state.question.answerType,
    overrules: { ...state.overrules },
    revealed,
    ...(revealed
      ? {
          questionText: state.question.text,
          anchorAnswer: state.anchorAnswer?.display || NO_ANSWER_LABEL,
          rows: buildRows(room, state),
        }
      : {}),
    eliminations: state.eliminations.map((entry) => ({ ...entry })),
    gameOver: state.gameOver,
    winnerPlayerIds: [...state.winnerPlayerIds],
    winnerTeamIds: [...state.winnerTeamIds],
    anchorSeconds: settings.anchorSeconds,
    turnSeconds: settings.turnSeconds,
    eligiblePlayerCount: state.alive.size,
  };
}

/**
 * Private state: the question is written ONLY for the player whose input is
 * open, and cleared from everyone else, so a stale payload can never leak it.
 * The anchor's answer never enters anybody's private state.
 */
function writePrivateState(
  room: InternalRoom,
  state: AvoidRoundState,
  phase: 'reveal' | 'avoid-anchor' | 'avoid-turn' | 'avoid-reveal',
  openPlayerId?: string
): void {
  const question = state.question;
  room.players.forEach((player) => {
    const priv = room.privateData[player.id] || (room.privateData[player.id] = {});
    priv.avoidAlive = state.alive.has(player.id);
    priv.avoidIsAnchor = player.id === state.anchorId;
    priv.avoidRoundPoints = state.roundPoints[player.id] || 0;

    const seesQuestion = Boolean(openPlayerId) && player.id === openPlayerId;
    if (!seesQuestion) {
      delete priv.avoidQuestion;
      delete priv.avoidQuestionCategory;
      delete priv.avoidAnswerType;
      delete priv.avoidChoices;
      delete priv.avoidNumberRange;
      priv.avoidIsActive = false;
      return;
    }

    priv.avoidQuestion = question.text;
    priv.avoidQuestionCategory = question.category;
    priv.avoidAnswerType = question.answerType;
    priv.avoidIsActive = true;
    if (question.choices) priv.avoidChoices = [...question.choices];
    if (question.numberRange) priv.avoidNumberRange = { ...question.numberRange };
    priv.secretInstructions = `Pick what the group is most likely to say and avoid ${state.anchorId === player.id ? 'being matched by the others' : "matching the anchor's answer"}.`;
  });
}

/** Refreshes private state for the phase currently running (used on reconnect). */
export function syncAvoidPrivateState(room: InternalRoom, phase: string): void {
  const state = activeRounds.get(room.code);
  if (!state) return;
  if (phase === 'reveal') {
    // The anchor already sees the question during the reveal phase.
    writePrivateState(room, state, 'reveal', state.anchorId);
    return;
  }
  if (phase === 'avoid-anchor') {
    writePrivateState(room, state, 'avoid-anchor', state.anchorId);
    return;
  }
  if (phase === 'avoid-turn') {
    writePrivateState(room, state, 'avoid-turn', nextAvoidTurnPlayerId(state) || undefined);
    return;
  }
  writePrivateState(room, state, 'avoid-reveal');
}

/* ──────────────────────────────── bot answers ────────────────────────────── */

const GENERIC_BOT_TEXT_ANSWERS = [
  'Pizza',
  'Chocolate',
  'Blue',
  'Mango',
  'Football',
  'Music',
  'Coffee',
  'Rain',
];

/**
 * A plausible answer for a simulated bot. Bots never call the AI: they draw from
 * the question's own `botAnswers`, from its options/range, or from the alive
 * players for 'player' questions.
 */
export function pickAvoidBotAnswer(
  room: InternalRoom,
  state: AvoidRoundState
): AvoidAnswerInput {
  const question = state.question;

  if (question.answerType === 'choice') {
    const options = question.choices || [];
    return { raw: options[Math.floor(Math.random() * options.length)] || '' };
  }

  if (question.answerType === 'number') {
    const range = question.numberRange || { min: 1, max: 20 };
    const value = range.min + Math.floor(Math.random() * (range.max - range.min + 1));
    return { raw: String(value) };
  }

  if (question.answerType === 'player') {
    const aliveIds = [...state.alive];
    const targetId = aliveIds[Math.floor(Math.random() * aliveIds.length)] || '';
    return { raw: targetId, playerId: targetId };
  }

  const pool =
    question.botAnswers && question.botAnswers.length > 0
      ? question.botAnswers
      : GENERIC_BOT_TEXT_ANSWERS;
  return { raw: pool[Math.floor(Math.random() * pool.length)] };
}

/* ───────────────────────────── results / end game ───────────────────────── */

/**
 * Placements by elimination order: the last player eliminated places highest,
 * players knocked out in the same round tie, and survivors share first place.
 */
export function buildAvoidPlacements(room: InternalRoom, state: AvoidRoundState): AvoidPlacement[] {
  const placementOf = new Map<string, number>();
  let placement = 1;

  const survivors = [...state.alive];
  if (survivors.length > 0) {
    survivors.forEach((playerId) => placementOf.set(playerId, placement));
    placement += 1;
  }

  for (let index = state.eliminations.length - 1; index >= 0; index -= 1) {
    const entry = state.eliminations[index];
    entry.playerIds.forEach((playerId) => placementOf.set(playerId, placement));
    placement += 1;
  }

  const teamOf = (playerId: string) =>
    room.teams.find((team) => team.id === room.players.find((p) => p.id === playerId)?.teamId);

  return room.players
    .map((player) => {
      const eliminatedRound =
        state.eliminations.find((entry) => entry.playerIds.includes(player.id))?.round ?? null;
      const team = teamOf(player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        colorIndex: player.colorIndex,
        placement: placementOf.get(player.id) ?? placement,
        eliminatedRound,
        pointsAdded: state.roundPoints[player.id] || 0,
        totalScore: player.score,
        isWinner: state.winnerPlayerIds.includes(player.id),
        ...(team ? { teamName: team.name, teamIcon: team.icon } : {}),
      };
    })
    .sort((a, b) => a.placement - b.placement || b.totalScore - a.totalScore);
}

/**
 * Final results: placements by elimination order plus the round's standings.
 */
export function calculateAvoidResults(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) {
    room.results = {
      summary: 'Game ended',
      standings: [],
      winnerTitle: 'Game Over',
    };
    return;
  }

  const placements = buildAvoidPlacements(room, state);
  const winners = placements.filter((entry) => entry.isWinner);

  const standings: PlayerResultStanding[] = placements.map((entry) => ({
    playerId: entry.playerId,
    playerName: entry.playerName,
    playerColor: room.players.find((player) => player.id === entry.playerId)?.colorHex || '#888888',
    colorIndex: entry.colorIndex,
    pointsAdded: entry.pointsAdded,
    totalScore: entry.totalScore,
    badge: entry.isWinner
      ? 'Winner'
      : entry.eliminatedRound !== null
      ? `Out in R${entry.eliminatedRound}`
      : undefined,
  }));

  const winnerTeams = room.teams.filter((team) => state.winnerTeamIds.includes(team.id));
  const summary = state.gameOver
    ? winnerTeams.length > 0
      ? `${winnerTeams.map((team) => `${team.icon} ${team.name}`).join(' & ')} win${
          winnerTeams.length === 1 ? 's' : ''
        }!`
      : winners.length === 1
      ? `${winners[0].playerName} outlasted everyone!`
      : `${winners.map((entry) => entry.playerName).join(' & ')} survived to the end!`
    : 'Round complete';

  room.results = {
    summary,
    category: 'Avoid the Word',
    whyHint:
      state.question.answerType === 'text'
        ? `The anchor answered "${state.anchorAnswer?.display || NO_ANSWER_LABEL}" to “${state.question.text}” — anyone who said something matching was knocked out.`
        : `The anchor answered "${state.anchorAnswer?.display || NO_ANSWER_LABEL}".`,
    standings,
    avoidPlacements: placements,
    avoidWinnerNames: winners.map((entry) => entry.playerName),
    avoidWinnerTeamNames: winnerTeams.map((team) => team.name),
    avoidEliminations: state.eliminations.map((entry) => ({ ...entry })),
    avoidRoundsPlayed: state.roundsPlayed,
    avoidAnchorNames: [],
    winnerTitle: winnerTeams.length > 0 ? 'Team Victory' : winners.length === 1 ? 'Sole Survivor' : 'Game Over',
  };
}
