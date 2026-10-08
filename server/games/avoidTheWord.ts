/**
 * Avoid the Word Game Module.
 * Server-authoritative logic for taboo card assignment, live describing turns,
 * buzz verification (majority or host override), and per-round scoring.
 *
 * The round is turn-based: every player describes their own secret subject once
 * per round while the rest of the room listens and can buzz if a taboo word slips.
 */

import { AvoidTheWordPrompt, getRandomAtwPrompt } from '../../shared/data/avoidTheWordPrompts';
import { InternalRoom } from '../roomManager';
import { AtwPublicState, AtwTurnResult, PlayerResultStanding } from '../../shared/types';

/** Seconds a describer gets before their turn is scored as a success. */
export const ATW_TURN_SECONDS = 45;

/** Points awarded for describing a subject without a confirmed taboo slip. */
export const ATW_POINTS_DESCRIBE_SUCCESS = 1;

/** Points awarded to every player on a buzz the group confirms. */
export const ATW_POINTS_CORRECT_BUZZ = 1;

/** Chance a simulated bot listener calls out a slip during a human turn. */
const ATW_BOT_BUZZ_CHANCE = 0.35;

/** Chance a simulated bot describer survives their own turn without a slip. */
const ATW_BOT_CLEAN_DESCRIBE_CHANCE = 0.7;

export type AtwTurnOutcome = 'timeout' | 'buzzed';

export interface AtwRoundState {
  prompts: Record<string, AvoidTheWordPrompt>;
  order: string[]; // describer rotation for this round (player ids)
  turnIndex: number; // index of the turn currently being played
  turnResults: AtwTurnResult[];
  buzzedPlayerIds: Set<string>; // buzzes cast on the active turn
  buzzConfirmed: boolean;
  roundPoints: Record<string, number>;
}

export interface AtwTurnInfo {
  describerId: string;
  describerName: string;
  turnNumber: number;
  totalTurns: number;
}

export interface AtwBuzzOutcome {
  accepted: boolean;
  buzzCount: number;
  requiredBuzzes: number;
  confirmed: boolean; // majority reached -> the caller must end the turn as failed
}

// In-memory store of active Avoid the Word round details per room
const activeRounds = new Map<string, AtwRoundState>();

/**
 * Shuffles an array with a rotation offset (used to rotate the turn order)
 */
function rotate<T>(items: T[], by: number): T[] {
  if (items.length === 0) return [];
  const offset = (((by % items.length) + items.length) % items.length);
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function connectedListenerCount(room: InternalRoom, describerId: string): number {
  return room.players.filter((p) => p.connected && p.id !== describerId).length;
}

/**
 * Strict majority of the listening players must buzz to end a turn early.
 * A single listener only needs one buzz of their own.
 */
function requiredBuzzes(room: InternalRoom, describerId: string): number {
  const listeners = Math.max(1, connectedListenerCount(room, describerId));
  return Math.floor(listeners / 2) + 1;
}

function buildPublicState(room: InternalRoom, state: AtwRoundState): AtwPublicState {
  const describerId = state.order[state.turnIndex] || '';
  return {
    describerIndex: room.players.findIndex((p) => p.id === describerId),
    describerPlayerId: describerId,
    turnResults: state.turnResults,
    buzzedPlayerIds: Array.from(state.buzzedPlayerIds),
    buzzConfirmed: state.buzzConfirmed,
    totalTurns: state.order.length,
    turnNumber: Math.min(state.turnIndex + 1, Math.max(1, state.order.length)),
    requiredBuzzes: describerId ? requiredBuzzes(room, describerId) : 1,
    turnActive: Boolean(describerId) && !state.buzzConfirmed,
    turnSeconds: ATW_TURN_SECONDS,
  };
}

function syncPublicState(room: InternalRoom, state: AtwRoundState): void {
  room.atwState = buildPublicState(room, state);
}

function clearBuzzMarks(room: InternalRoom): void {
  room.players.forEach((player) => {
    const priv = room.privateData[player.id];
    if (priv) priv.atwBuzzed = false;
  });
}

/**
 * 1. Reveal Phase
 * Every player privately receives a unique subject plus exactly 3 taboo words.
 * The turn order rotates each round so a different player opens the round.
 */
export function setupAvoidTheWordRound(room: InternalRoom): void {
  const players = room.players;
  const prompts: Record<string, AvoidTheWordPrompt> = {};
  const usedSubjects: string[] = [];

  players.forEach((player) => {
    const prompt = getRandomAtwPrompt(usedSubjects);
    usedSubjects.push(prompt.subject);
    prompts[player.id] = prompt;
  });

  const state: AtwRoundState = {
    prompts,
    order: rotate(
      players.map((p) => p.id),
      room.roundNumber - 1
    ),
    turnIndex: 0,
    turnResults: [],
    buzzedPlayerIds: new Set(),
    buzzConfirmed: false,
    roundPoints: {},
  };

  activeRounds.set(room.code, state);
  room.privateData = {};

  players.forEach((player) => {
    const prompt = prompts[player.id];
    room.privateData[player.id] = {
      role: 'Describer',
      atwSubject: prompt.subject,
      atwForbidden: prompt.forbidden,
      atwCategory: prompt.category,
      atwIsDescriber: false,
      atwBuzzed: false,
      atwRoundPoints: 0,
      secretHint: `Category: ${prompt.category}`,
      secretInstructions: `When your turn comes you get ${ATW_TURN_SECONDS}s to describe "${prompt.subject}" out loud — never say ${prompt.forbidden.join(', ')}.`,
    };
  });

  syncPublicState(room, state);
  room.phasePrompt = 'Read Your Secret Card';
  room.phaseSubprompt = 'Memorize your subject and your 3 taboo words!';
}

/**
 * 2. Turn Start
 * Resets the buzz slate and marks exactly one player as the active describer.
 * Returns null once every player has had their turn this round.
 */
export function beginAtwTurn(room: InternalRoom): AtwTurnInfo | null {
  const state = activeRounds.get(room.code);
  if (!state) return null;

  const describerId = state.order[state.turnIndex];
  if (!describerId) return null;

  state.buzzedPlayerIds = new Set();
  state.buzzConfirmed = false;
  clearBuzzMarks(room);

  room.players.forEach((player) => {
    if (!room.privateData[player.id]) {
      room.privateData[player.id] = {};
    }
    room.privateData[player.id].atwIsDescriber = player.id === describerId;
  });

  const describer = room.players.find((p) => p.id === describerId);
  syncPublicState(room, state);

  return {
    describerId,
    describerName: describer?.name || 'Player',
    turnNumber: state.turnIndex + 1,
    totalTurns: state.order.length,
  };
}

/**
 * 3. Buzz Handling
 * Listeners tap to flag a taboo slip. Tapping again withdraws the buzz before
 * it is confirmed. Reaching a strict majority auto-confirms the buzz.
 */
export function toggleAtwBuzz(room: InternalRoom, playerId: string): AtwBuzzOutcome {
  const state = activeRounds.get(room.code);
  const rejected: AtwBuzzOutcome = {
    accepted: false,
    buzzCount: 0,
    requiredBuzzes: 1,
    confirmed: false,
  };

  if (!state) return rejected;

  const describerId = state.order[state.turnIndex];
  if (!describerId || state.buzzConfirmed) return rejected;

  // A describer cannot buzz themselves and only room members may buzz.
  if (playerId === describerId) return rejected;
  const buzzer = room.players.find((p) => p.id === playerId);
  if (!buzzer) return rejected;

  if (state.buzzedPlayerIds.has(playerId)) {
    state.buzzedPlayerIds.delete(playerId);
  } else {
    state.buzzedPlayerIds.add(playerId);
  }

  if (!room.privateData[playerId]) room.privateData[playerId] = {};
  room.privateData[playerId].atwBuzzed = state.buzzedPlayerIds.has(playerId);

  const required = requiredBuzzes(room, describerId);
  if (state.buzzedPlayerIds.size >= required) {
    state.buzzConfirmed = true;
  }

  syncPublicState(room, state);

  return {
    accepted: true,
    buzzCount: state.buzzedPlayerIds.size,
    requiredBuzzes: required,
    confirmed: state.buzzConfirmed,
  };
}

/**
 * Host override on a pending buzz: either force the confirmation (end the turn
 * early as a failure) or dismiss every buzz and let the describer keep going.
 * Returns true when the caller must end the turn.
 */
export function resolveAtwBuzz(room: InternalRoom, confirm: boolean): boolean {
  const state = activeRounds.get(room.code);
  if (!state) return false;

  const describerId = state.order[state.turnIndex];
  if (!describerId) return false;

  if (confirm) {
    // Nothing to confirm when the room has not buzzed anyone.
    if (state.buzzedPlayerIds.size === 0) return false;
    state.buzzConfirmed = true;
    syncPublicState(room, state);
    return true;
  }

  state.buzzedPlayerIds.clear();
  state.buzzConfirmed = false;
  clearBuzzMarks(room);
  syncPublicState(room, state);
  return false;
}

/**
 * 4. Turn Resolution
 * 'timeout' = the describer survived the full timer (success).
 * 'buzzed'  = the group confirmed a taboo slip, ending the turn early (failure).
 * Successful describes and confirmed buzzes both score.
 */
export function completeAtwTurn(
  room: InternalRoom,
  outcome: AtwTurnOutcome
): AtwTurnResult | null {
  const state = activeRounds.get(room.code);
  if (!state) return null;

  const describerId = state.order[state.turnIndex];
  const describer = room.players.find((p) => p.id === describerId);
  const prompt = describerId ? state.prompts[describerId] : undefined;
  if (!describerId || !describer || !prompt) return null;

  const success = outcome === 'timeout';
  const buzzerIds = success ? [] : Array.from(state.buzzedPlayerIds);

  const describerPoints = success ? ATW_POINTS_DESCRIBE_SUCCESS : 0;
  describer.score += describerPoints;
  state.roundPoints[describerId] = (state.roundPoints[describerId] || 0) + describerPoints;

  // Everyone whose buzz the group confirmed scores for calling it out.
  buzzerIds.forEach((buzzerId) => {
    const buzzer = room.players.find((p) => p.id === buzzerId);
    if (!buzzer) return;
    buzzer.score += ATW_POINTS_CORRECT_BUZZ;
    state.roundPoints[buzzerId] = (state.roundPoints[buzzerId] || 0) + ATW_POINTS_CORRECT_BUZZ;
  });

  const result: AtwTurnResult = {
    playerId: describerId,
    playerName: describer.name,
    playerColor: describer.colorHex,
    colorIndex: describer.colorIndex,
    subject: prompt.subject,
    forbidden: prompt.forbidden,
    success,
    buzzCount: buzzerIds.length,
    pointsAdded: describerPoints,
    buzzedByNames: buzzerIds.map(
      (buzzerId) => room.players.find((p) => p.id === buzzerId)?.name || 'Player'
    ),
  };

  state.turnResults.push(result);
  state.turnIndex += 1;
  state.buzzedPlayerIds.clear();
  state.buzzConfirmed = false;
  clearBuzzMarks(room);

  room.players.forEach((player) => {
    const priv = room.privateData[player.id];
    if (!priv) return;
    priv.atwIsDescriber = false;
    if (player.id === describerId) {
      priv.atwRoundPoints = state.roundPoints[describerId] || 0;
    }
  });

  syncPublicState(room, state);
  return result;
}

/** True while the round still has describers waiting for their turn. */
export function hasMoreAtwTurns(room: InternalRoom): boolean {
  const state = activeRounds.get(room.code);
  if (!state) return false;
  return state.turnIndex < state.order.length;
}

/**
 * Simulated bot listeners: each idle bot may call out a slip.
 * Pass force=true to guarantee buzzes (used when a bot turn is scripted to fail).
 */
export function simulateAtwBotBuzzes(room: InternalRoom, force = false): number {
  const state = activeRounds.get(room.code);
  if (!state) return 0;

  const describerId = state.order[state.turnIndex];
  if (!describerId) return 0;

  const before = state.buzzedPlayerIds.size;

  room.players
    .filter((p) => p.isBot && p.id !== describerId && !state.buzzedPlayerIds.has(p.id))
    .forEach((bot) => {
      if (!force && Math.random() > ATW_BOT_BUZZ_CHANCE) return;
      toggleAtwBuzz(room, bot.id);
    });

  return state.buzzedPlayerIds.size - before;
}

/** Bot describers cannot speak, so their turn resolves to a scripted outcome. */
export function decideAtwBotDescribeOutcome(): AtwTurnOutcome {
  return Math.random() < ATW_BOT_CLEAN_DESCRIBE_CHANCE ? 'timeout' : 'buzzed';
}

/**
 * 5. Results & Scoreboard
 * Reveals every turn of the round (subject + taboo words + success/fail)
 * alongside the running standings.
 */
export function calculateAtwResults(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  const turnResults = state?.turnResults || [];
  const roundPoints = state?.roundPoints || {};

  const totalTurns = turnResults.length;
  const successes = turnResults.filter((t) => t.success).length;

  const standings: PlayerResultStanding[] = room.players.map((player) => {
    const turn = turnResults.find((t) => t.playerId === player.id);
    let badge: string | undefined;
    if (turn) {
      badge = turn.success ? 'Clean' : 'Buzzed';
    }

    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      pointsAdded: roundPoints[player.id] || 0,
      totalScore: player.score,
      badge,
    };
  });

  standings.sort((a, b) => b.totalScore - a.totalScore);

  const failedTurn = turnResults.find((t) => !t.success);

  let whyHint: string;
  if (failedTurn) {
    whyHint = `${failedTurn.playerName} got buzzed out describing "${failedTurn.subject}" — their traps were ${failedTurn.forbidden.join(
      ', '
    )}, and ${failedTurn.buzzCount} ${failedTurn.buzzCount === 1 ? 'buzz' : 'buzzes'} confirmed the slip.`;
  } else if (totalTurns > 0) {
    whyHint = `Nobody said a taboo word — all ${successes} describes stayed clean.`;
  } else {
    whyHint = 'No turns were played this round.';
  }

  const bestDescriber = [...turnResults]
    .filter((t) => t.pointsAdded > 0)
    .sort((a, b) => b.pointsAdded - a.pointsAdded)[0];

  room.results = {
    summary:
      totalTurns > 0
        ? `${successes} of ${totalTurns} describes stayed clean`
        : 'No turns were played this round',
    category: 'Avoid the Word',
    whyHint,
    atwTurnResults: turnResults,
    standings,
    winnerTitle: bestDescriber ? `${bestDescriber.playerName} nailed it!` : 'Taboo Round Complete',
  };
}

/**
 * Cleans up active round state when a room returns to the lobby
 */
export function cleanupAvoidTheWordRound(roomCode: string): void {
  activeRounds.delete(roomCode);
}
