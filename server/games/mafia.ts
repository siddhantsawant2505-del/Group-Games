/**
 * Mafia — server-authoritative game module.
 *
 * One full game (many nights and days until a faction wins) is one room "round".
 * Roles, night actions, doctor protection, detective findings and secret ballots
 * live only in this module's per-room state; they reach players exclusively
 * through their own private state, and the public mirror never carries a living
 * player's role.
 *
 * All scoring goes through awardPoints() so team mode rolls up automatically.
 */

import {
  MAFIA_ROLE_LABELS,
  MAFIA_ROLE_TAGLINES,
  MafiaDeathAnnouncement,
  MafiaElimination,
  MafiaInvestigation,
  MafiaPublicPhase,
  MafiaPublicState,
  MafiaRecapEntry,
  MafiaRole,
  MafiaRoleBreakdown,
  MafiaSettings,
  MafiaSide,
  MafiaTeamSelection,
  PlayerResultStanding,
  RoleRevealInfo,
  VoteBreakdownItem,
} from '../../shared/types';
import { MafiaNarrationBag } from '../../shared/data/mafiaNarration';
import { awardPoints } from '../scoring';
import type { InternalRoom } from '../roomManager';
import {
  SKIP_VOTE,
  VoteOutcome,
  assignRoles,
  checkWin,
  resolveNight,
  sideOf,
  tallyVote,
  validateSettings,
} from './mafia.engine';

/** Seconds each beat stays on screen. */
export const MAFIA_MORNING_SECONDS = 8;
export const MAFIA_EXILE_SECONDS = 8;
export const MAFIA_REVEAL_SECONDS = 10;

/** Scoring: every winner, plus a survivor bonus. */
export const MAFIA_WIN_POINTS = 3;
export const MAFIA_SURVIVOR_BONUS = 1;

/** A bot Mafia follows a teammate's pick this often instead of choosing its own. */
const BOT_TEAMMATE_AGREEMENT = 0.6;

const FALLBACK_SETTINGS: MafiaSettings = {
  nightSeconds: 30,
  discussionSeconds: 120,
  voteSeconds: 30,
  mafiaCount: 'auto',
  detective: true,
  doctor: true,
  revealRoleOnDeath: true,
};

export interface MafiaRoundState {
  roles: Record<string, MafiaRole>;
  alive: Set<string>;
  mafiaIds: string[];
  breakdown: MafiaRoleBreakdown;
  settings: MafiaSettings;

  phase: MafiaPublicPhase;
  nightNumber: number;
  dayNumber: number;

  /** actorPlayerId → targetPlayerId (only actors who picked a target). */
  nightActions: Record<string, string>;
  nightConfirmed: Set<string>;
  lastNightVictimId: string | null;
  lastNightTargetId: string | null;
  lastDoctorTargetId: string | null;
  doctorLastProtected: string | null;
  investigations: Record<string, MafiaInvestigation[]>;
  lastDetectiveFinding: MafiaInvestigation | null;

  votes: Record<string, string>;
  readyToVote: Set<string>;
  lastVote: VoteOutcome | null;
  lastExiledId: string | null;

  eliminations: MafiaElimination[];
  deaths: MafiaDeathAnnouncement[];

  winningSide: MafiaSide | null;
  gameOver: boolean;
  /** Points are awarded exactly once, even if results are re-entered. */
  resultsApplied: boolean;

  recap: MafiaRecapEntry[];
  nightNarration: string;
  morningNarration: string;
  exileNarration: string;
  currentNarration: string;
  narration: MafiaNarrationBag;
}

const activeRounds = new Map<string, MafiaRoundState>();

export function getMafiaRound(roomCode: string): MafiaRoundState | undefined {
  return activeRounds.get(roomCode.toUpperCase());
}

export function cleanupMafiaRound(roomCode: string): void {
  activeRounds.delete(roomCode.toUpperCase());
}

function stateFor(room: InternalRoom): MafiaRoundState | undefined {
  return activeRounds.get(room.code);
}

/** Reads the room's Mafia settings with a safe fallback for old rooms. */
export function readMafiaSettings(room: InternalRoom): MafiaSettings {
  const stored = room.gameSettings?.mafia;
  if (!stored) return { ...FALLBACK_SETTINGS };
  return {
    nightSeconds: Number.isFinite(stored.nightSeconds) ? stored.nightSeconds : 30,
    discussionSeconds: Number.isFinite(stored.discussionSeconds) ? stored.discussionSeconds : 120,
    voteSeconds: Number.isFinite(stored.voteSeconds) ? stored.voteSeconds : 30,
    mafiaCount: stored.mafiaCount === 'auto' ? 'auto' : Math.floor(Number(stored.mafiaCount) || 1),
    detective: Boolean(stored.detective),
    doctor: Boolean(stored.doctor),
    revealRoleOnDeath: stored.revealRoleOnDeath !== false,
  };
}

function playerName(room: InternalRoom, playerId: string | null | undefined): string | null {
  if (!playerId) return null;
  return room.players.find((player) => player.id === playerId)?.name ?? null;
}

function roleOf(state: MafiaRoundState, playerId: string): MafiaRole {
  return state.roles[playerId] ?? 'townsperson';
}

export function getLivingPlayerIds(room: InternalRoom): string[] {
  const state = stateFor(room);
  if (!state) return room.players.map((player) => player.id);
  return room.players.filter((player) => state.alive.has(player.id)).map((player) => player.id);
}

export function isPlayerAlive(room: InternalRoom, playerId: string): boolean {
  const state = stateFor(room);
  if (!state) return true;
  return state.alive.has(playerId);
}

/** Living Mafia members, in room order. */
export function getMafiaIds(room: InternalRoom): string[] {
  const state = stateFor(room);
  if (!state) return [];
  return room.players
    .filter((player) => state.roles[player.id] === 'mafia' && state.alive.has(player.id))
    .map((player) => player.id);
}

/** The Mafia's live picks, for the faction-private team update. */
export function getMafiaTeamPicks(
  room: InternalRoom
): { playerId: string; playerName: string; targetName: string | null }[] {
  const state = stateFor(room);
  if (!state) return [];
  return room.players
    .filter((player) => state.roles[player.id] === 'mafia' && state.alive.has(player.id))
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      targetName: playerName(room, state.nightActions[player.id]),
    }));
}

export function getMafiaRoleLabel(role: MafiaRole): string {
  return MAFIA_ROLE_LABELS[role];
}

/* ───────────────────────────── Setup ────────────────────────────────────── */

/**
 * Deals a fresh game: random roles, everyone alive, counters at zero and a new
 * narration bag. Returns false when the table cannot legally play, so the room
 * manager can send everybody back to game select instead of dealing a broken
 * game.
 */
export function setupMafiaRound(room: InternalRoom): boolean {
  const settings = readMafiaSettings(room);
  const playerIds = room.players.map((player) => player.id);
  const validation = validateSettings(playerIds.length, settings);
  if (!validation.valid) return false;

  const deal = assignRoles(playerIds, settings);
  const state: MafiaRoundState = {
    roles: deal.roles,
    alive: new Set(playerIds),
    mafiaIds: deal.mafiaIds,
    breakdown: deal.breakdown,
    settings,

    phase: 'reveal',
    nightNumber: 0,
    dayNumber: 0,

    nightActions: {},
    nightConfirmed: new Set(),
    lastNightVictimId: null,
    lastNightTargetId: null,
    lastDoctorTargetId: null,
    doctorLastProtected: null,
    investigations: {},
    lastDetectiveFinding: null,

    votes: {},
    readyToVote: new Set(),
    lastVote: null,
    lastExiledId: null,

    eliminations: [],
    deaths: [],

    winningSide: null,
    gameOver: false,
    resultsApplied: false,

    recap: [],
    nightNarration: '',
    morningNarration: '',
    exileNarration: '',
    currentNarration: 'Roles are dealt. The village will never be the same.',
    narration: new MafiaNarrationBag(),
  };

  activeRounds.set(room.code, state);

  room.privateData = {};
  room.hasVoted.clear();
  room.voteTallies = {};
  room.playerVotes = {};
  room.revealedAnswers = [];

  writePrivateState(room);
  syncMafiaPublicState(room);
  return true;
}

/* ───────────────────────────── Private state ────────────────────────────── */

function nightCopyFor(role: MafiaRole): { prompt: string; label: string } {
  switch (role) {
    case 'mafia':
      return {
        prompt: 'Choose the player the family eliminates tonight.',
        label: 'Choose a victim',
      };
    case 'detective':
      return {
        prompt: 'Choose one player to investigate. You learn whether they are Mafia.',
        label: 'Choose someone to investigate',
      };
    case 'doctor':
      return {
        prompt: 'Choose one player to protect from the night’s kill — including yourself.',
        label: 'Choose someone to protect',
      };
    default:
      // The decoy has the same shape and weight as a real night action.
      return {
        prompt: 'Who do you trust the most tonight?',
        label: 'Register your read',
      };
  }
}

function buildTeamSelections(room: InternalRoom, state: MafiaRoundState): MafiaTeamSelection[] {
  return room.players
    .filter((player) => state.roles[player.id] === 'mafia' && state.alive.has(player.id))
    .map((player) => ({
      playerName: player.name,
      targetName: playerName(room, state.nightActions[player.id]),
    }));
}

function teammateNamesFor(room: InternalRoom, state: MafiaRoundState, viewerId: string): string[] {
  return room.players
    .filter(
      (player) =>
        player.id !== viewerId &&
        state.roles[player.id] === 'mafia' &&
        state.alive.has(player.id)
    )
    .map((player) => player.name);
}

/**
 * Writes each player's own secrets into their private state. This is the only
 * path by which roles, teammates, protection history and findings leave memory.
 */
export function syncMafiaPrivateState(room: InternalRoom): void {
  const state = stateFor(room);
  if (!state) return;

  const livingMafia = getMafiaIds(room);
  const secondsRemaining = room.timer?.remainingSeconds ?? 0;
  const nightRunning = state.phase === 'night';

  room.players.forEach((player) => {
    const role = roleOf(state, player.id);
    const alive = state.alive.has(player.id);
    const priv = room.privateData[player.id] ?? (room.privateData[player.id] = {});
    const isMafia = role === 'mafia';
    const isDetective = role === 'detective';
    const isDoctor = role === 'doctor';
    // The dead are spectators: they keep their own role (they already know it)
    // but receive no living teammates, picks, protection history or findings.
    const teammates = isMafia && alive ? teammateNamesFor(room, state, player.id) : [];

    priv.role = MAFIA_ROLE_LABELS[role];
    priv.isSpecialRole = isMafia;
    priv.specialAccentBg = isMafia;
    priv.mafiaRole = role;
    priv.mafiaRoleLabel = MAFIA_ROLE_LABELS[role];
    priv.mafiaSide = sideOf(role);
    priv.mafiaRoleTagline = MAFIA_ROLE_TAGLINES[role];
    priv.mafiaIsAlive = alive;
    priv.mafiaSecondsRemaining = secondsRemaining;

    priv.mafiaTeammateNames = isMafia && alive ? teammates : undefined;
    priv.mafiaTeammateIds =
      isMafia && alive ? livingMafia.filter((id) => id !== player.id) : undefined;
    priv.mafiaTeamSelections =
      isMafia && alive ? (nightRunning ? buildTeamSelections(room, state) : []) : undefined;

    const copy = nightCopyFor(role);
    priv.mafiaCanAct = alive && nightRunning;
    priv.mafiaActionLabel = alive ? copy.label : undefined;
    priv.mafiaActionPrompt = alive ? copy.prompt : undefined;
    priv.mafiaCanSkip = alive && (isMafia || isDoctor);
    priv.mafiaActionSubmitted = nightRunning && state.nightConfirmed.has(player.id);
    priv.mafiaActionTargetId = state.nightActions[player.id] ?? null;
    priv.mafiaActionTargetName = playerName(room, state.nightActions[player.id]);

    priv.mafiaInvestigations =
      isDetective && alive ? state.investigations[player.id] ?? [] : undefined;
    priv.mafiaLastFinding = isDetective && alive ? state.lastDetectiveFinding : null;
    priv.mafiaLastProtectedName = isDoctor && alive
      ? playerName(room, state.doctorLastProtected)
      : null;

    priv.mafiaReadyToVote = state.readyToVote.has(player.id);
    priv.mafiaVoteSubmitted = Boolean(state.votes[player.id]);
    priv.mafiaVoteTargetName =
      state.votes[player.id] === SKIP_VOTE
        ? 'Skip'
        : playerName(room, state.votes[player.id]);

    if (isMafia) {
      priv.secretInstructions = teammates.length
        ? `You are the Mafia with ${teammates.join(', ')}. Each night the family picks one victim; by day you are one more innocent face.`
        : 'You are the lone Mafia. Each night you pick one victim; by day you are one more innocent face.';
    } else if (isDetective) {
      priv.secretInstructions =
        'Each night you may investigate one player and learn whether they are Mafia. Share only what you choose to.';
    } else if (isDoctor) {
      priv.secretInstructions =
        'Each night you may protect one player from the Mafia’s kill — yourself included, but never the same player two nights running.';
    } else {
      priv.secretInstructions =
        'You have no night action. Watch, listen and vote out the Mafia before they outnumber the village.';
    }

    priv.voteSubmitted = Boolean(state.votes[player.id]);
    priv.votedForPlayerId = state.votes[player.id];
  });
}

/* ───────────────────────────── Public state ─────────────────────────────── */

/**
 * Mirrors the safe subset of the game into `room.mafiaState`. No living player's
 * role is ever written here; a dead player carries a role only when the host left
 * `revealRoleOnDeath` on.
 */
export function syncMafiaPublicState(room: InternalRoom): void {
  const state = stateFor(room);
  if (!state) {
    room.mafiaState = null;
    return;
  }

  const reveal = state.settings.revealRoleOnDeath;
  const alivePlayerIds = getLivingPlayerIds(room);
  const lastVictim = state.lastNightVictimId;
  const lastExiled = state.lastExiledId;
  const ballotVisible = state.phase === 'exile' || state.phase === 'over';

  const voteBreakdown: VoteBreakdownItem[] = [];
  if (state.lastVote && ballotVisible) {
    Object.entries(state.votes).forEach(([voterId, targetId]) => {
      const voter = room.players.find((player) => player.id === voterId);
      if (!voter) return;
      const target = room.players.find((player) => player.id === targetId);
      voteBreakdown.push({
        voterId,
        voterName: voter.name,
        voterColorIndex: voter.colorIndex,
        targetId,
        targetName: targetId === SKIP_VOTE ? 'Skip' : target?.name ?? 'Player',
        isCorrect: false,
      });
    });
  }

  const publicState: MafiaPublicState = {
    phase: state.phase,
    nightNumber: state.nightNumber,
    dayNumber: state.dayNumber,
    mafiaCount: state.breakdown.mafia,
    hasDetective: state.breakdown.detective,
    hasDoctor: state.breakdown.doctor,
    alivePlayerIds,
    eliminatedIds: state.eliminations.map((entry) => entry.playerId),
    eliminations: state.eliminations,
    deaths: state.deaths,
    lastNightVictimId: lastVictim,
    lastNightVictimName: playerName(room, lastVictim),
    lastNightVictimRole:
      reveal && lastVictim && state.roles[lastVictim] ? state.roles[lastVictim] : null,
    lastExiledId: lastExiled,
    lastExiledName: playerName(room, lastExiled),
    lastExiledRole:
      reveal && lastExiled && state.roles[lastExiled] ? state.roles[lastExiled] : null,
    nightConfirmedCount: state.phase === 'night' ? state.nightConfirmed.size : 0,
    nightActorCount: state.phase === 'night' ? state.alive.size : 0,
    pendingNightActions:
      state.phase === 'night'
        ? Math.max(0, state.alive.size - state.nightConfirmed.size)
        : 0,
    voteTally: state.lastVote && ballotVisible ? { ...state.lastVote.tally } : {},
    voteBreakdown,
    skippedVoteCount: state.lastVote && ballotVisible ? state.lastVote.skipCount : 0,
    readyToVoteIds: [...state.readyToVote],
    narration: state.currentNarration,
    morningNarration: state.morningNarration,
    exileNarration: state.exileNarration,
    nightSeconds: state.settings.nightSeconds,
    discussionSeconds: state.settings.discussionSeconds,
    voteSeconds: state.settings.voteSeconds,
    revealRoleOnDeath: reveal,
    roleBreakdown: { ...state.breakdown },
    winningSide: state.winningSide,
    gameOver: state.gameOver,
    recap: state.gameOver ? state.recap : [],
  };

  room.mafiaState = publicState;
}

/* ───────────────────────────── Night ────────────────────────────────────── */

/** Opens a fresh night: clears the slate, narrates nightfall, marks the phase. */
export function beginMafiaNight(room: InternalRoom): void {
  const state = stateFor(room);
  if (!state || state.gameOver) return;

  state.phase = 'night';
  state.nightNumber += 1;
  state.nightActions = {};
  state.nightConfirmed = new Set();
  state.lastNightVictimId = null;
  state.lastNightTargetId = null;
  state.lastDoctorTargetId = null;
  state.lastDetectiveFinding = null;

  state.nightNarration = state.narration.draw('night');
  state.currentNarration = state.nightNarration;

  room.hasVoted.clear();
  room.voteTallies = {};
  room.playerVotes = {};

  writePrivateState(room);
  syncMafiaPublicState(room);
}

/**
 * Locks in one night action. Every living player confirms exactly one choice, so
 * the layout and the effort are identical for every role; the decoy target is
 * discarded at resolution. `targetId === null` is an abstention (Mafia/Doctor), or
 * a plain confirmation for the other roles.
 */
export function submitMafiaNightAction(
  room: InternalRoom,
  playerId: string,
  targetId: string | null
): { accepted: boolean; complete: boolean; error?: string } {
  const state = stateFor(room);
  if (!state || state.phase !== 'night') {
    return { accepted: false, complete: false, error: 'The night is not open.' };
  }
  if (!state.alive.has(playerId)) {
    return { accepted: false, complete: false, error: 'The dead cannot act.' };
  }
  if (state.nightConfirmed.has(playerId)) {
    return { accepted: false, complete: false, error: 'Your action is already locked in.' };
  }

  const role = roleOf(state, playerId);
  const target = targetId
    ? room.players.find((player) => player.id === targetId && state.alive.has(player.id))
    : null;

  if (targetId && !target) {
    return { accepted: false, complete: false, error: 'Pick a living player.' };
  }

  if (role === 'mafia' && target && roleOf(state, target.id) === 'mafia') {
    return { accepted: false, complete: false, error: 'The Mafia never targets its own.' };
  }
  if (role === 'doctor' && target && target.id === state.doctorLastProtected) {
    return {
      accepted: false,
      complete: false,
      error: 'You protected that player last night — pick someone else.',
    };
  }
  if (role === 'detective' && target && target.id === playerId) {
    return { accepted: false, complete: false, error: 'Investigating yourself tells you nothing.' };
  }

  // The decoy is a real confirmation with a harmless target; it is never read at
  // resolution, so the shape of the night is identical for everyone.
  if (target) state.nightActions[playerId] = target.id;
  else delete state.nightActions[playerId];
  state.nightConfirmed.add(playerId);

  writePrivateState(room);
  syncMafiaPublicState(room);

  return {
    accepted: true,
    complete: state.nightConfirmed.size >= state.alive.size,
  };
}

/** Living players who still owe a night confirmation. */
export function mafiaNightPending(room: InternalRoom): number {
  const state = stateFor(room);
  if (!state || state.phase !== 'night') return 0;
  return Math.max(0, state.alive.size - state.nightConfirmed.size);
}

/** A single bot's choice, or null when it has nothing legal to do. */
export function pickMafiaBotNightAction(room: InternalRoom, playerId: string): string | null {
  const state = stateFor(room);
  if (!state || !state.alive.has(playerId)) return null;

  const role = roleOf(state, playerId);
  const living = getLivingPlayerIds(room);

  if (role === 'mafia') {
    const candidates = living.filter((id) => id !== playerId && roleOf(state, id) !== 'mafia');
    if (candidates.length === 0) return null;

    const teammatePick = getMafiaIds(room)
      .filter((id) => id !== playerId)
      .map((id) => state.nightActions[id])
      .find((targetId): targetId is string => Boolean(targetId) && candidates.includes(targetId));

    if (teammatePick && Math.random() < BOT_TEAMMATE_AGREEMENT) return teammatePick;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  if (role === 'doctor') {
    const candidates = living.filter((id) => id !== state.doctorLastProtected);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  if (role === 'detective') {
    const checked = new Set((state.investigations[playerId] ?? []).map((entry) => entry.targetName));
    const unchecked = living.filter(
      (id) => id !== playerId && !checked.has(playerName(room, id) ?? '')
    );
    const candidates = unchecked.length > 0 ? unchecked : living.filter((id) => id !== playerId);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // A decoy: any other living player. It never changes the outcome.
  const candidates = living.filter((id) => id !== playerId);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Locks in every living bot's night action. Returns how many were submitted. */
export function simulateMafiaBotNightActions(room: InternalRoom): number {
  const state = stateFor(room);
  if (!state || state.phase !== 'night') return 0;

  let submitted = 0;
  room.players.forEach((player) => {
    if (!player.isBot) return;
    if (!state.alive.has(player.id)) return;
    if (state.nightConfirmed.has(player.id)) return;

    const target = pickMafiaBotNightAction(room, player.id);
    const outcome = submitMafiaNightAction(room, player.id, target);
    if (outcome.accepted) submitted += 1;
  });
  return submitted;
}

/* ───────────────────────────── Morning ──────────────────────────────────── */

function addDeath(
  room: InternalRoom,
  state: MafiaRoundState,
  playerId: string,
  cause: MafiaElimination['cause']
): void {
  if (!state.alive.has(playerId)) return;
  state.alive.delete(playerId);

  const player = room.players.find((entry) => entry.id === playerId);
  const role = roleOf(state, playerId);
  state.eliminations.push({
    playerId,
    playerName: player?.name ?? 'Player',
    night: state.nightNumber,
    cause,
    ...(cause === 'exile' ? { day: state.dayNumber } : {}),
  });

  state.deaths.push({
    playerId,
    playerName: player?.name ?? 'Player',
    colorIndex: player?.colorIndex ?? 0,
    cause,
    night: state.nightNumber,
    day: cause === 'exile' ? state.dayNumber : null,
    role: state.settings.revealRoleOnDeath ? role : null,
    roleLabel: state.settings.revealRoleOnDeath ? MAFIA_ROLE_LABELS[role] : null,
  });

  const priv = room.privateData[playerId];
  if (priv) {
    priv.mafiaIsAlive = false;
    priv.mafiaCanAct = false;
  }
}

/** The role clause appended to a death/exile line, only when the host allows it. */
function roleClause(state: MafiaRoundState, playerId: string): string {
  if (!state.settings.revealRoleOnDeath) return '';
  return ` They were the ${MAFIA_ROLE_LABELS[roleOf(state, playerId)]}.`;
}

/**
 * Resolves the night exactly once and moves to MORNING:
 * kill (unless saved), detective finding, narration, recap, win not yet checked.
 */
export function resolveMafiaNight(room: InternalRoom): void {
  const state = stateFor(room);
  if (!state || state.phase !== 'night') return;

  const living = [...state.alive];
  const mafiaTargets: Record<string, string> = {};
  living.forEach((playerId) => {
    if (roleOf(state, playerId) !== 'mafia') return;
    const target = state.nightActions[playerId];
    if (target) mafiaTargets[playerId] = target;
  });

  const doctorId = living.find((playerId) => roleOf(state, playerId) === 'doctor');
  const detectiveId = living.find((playerId) => roleOf(state, playerId) === 'detective');

  const resolution = resolveNight({
    roles: state.roles,
    alive: living,
    night: state.nightNumber,
    doctorLastProtected: state.doctorLastProtected,
    actions: {
      mafiaTargets,
      doctorTarget: doctorId ? state.nightActions[doctorId] ?? null : null,
      detectiveTarget: detectiveId ? state.nightActions[detectiveId] ?? null : null,
    },
  });

  state.lastNightTargetId = resolution.mafiaTargetId;
  state.lastDoctorTargetId = resolution.doctorTargetId;
  state.doctorLastProtected = resolution.doctorTargetId;
  state.lastDetectiveFinding = null;

  if (resolution.detective && detectiveId) {
    const finding: MafiaInvestigation = {
      night: state.nightNumber,
      targetName: playerName(room, resolution.detective.targetId) ?? 'Player',
      isMafia: resolution.detective.isMafia,
    };
    if (!state.investigations[detectiveId]) state.investigations[detectiveId] = [];
    state.investigations[detectiveId].push(finding);
    state.lastDetectiveFinding = finding;
  }

  if (resolution.victimId) {
    addDeath(room, state, resolution.victimId, 'night-kill');
  }
  state.lastNightVictimId = resolution.victimId;

  const targetName = playerName(room, resolution.mafiaTargetId);
  const protectedName = playerName(room, resolution.doctorTargetId);
  const victimName = playerName(room, resolution.victimId);
  const recapLines: string[] = [
    targetName ? `The Mafia targeted ${targetName}.` : 'The Mafia did not choose a victim.',
  ];
  if (protectedName) recapLines.push(`The Doctor protected ${protectedName}.`);
  if (state.lastDetectiveFinding && detectiveId) {
    recapLines.push(
      `${playerName(room, detectiveId) ?? 'The Detective'} investigated ${
        state.lastDetectiveFinding.targetName
      }: ${state.lastDetectiveFinding.isMafia ? 'Mafia' : 'Not Mafia'}.`
    );
  }
  recapLines.push(
    resolution.victimId
      ? `${victimName} was eliminated overnight.`
      : 'Nobody died tonight.'
  );
  state.recap.push({ kind: 'night', label: `Night ${state.nightNumber}`, lines: recapLines });

  state.morningNarration =
    state.narration.draw(
      resolution.victimId ? 'morning-death' : 'morning-calm',
      victimName ?? undefined
    ) + (resolution.victimId ? roleClause(state, resolution.victimId) : '');
  state.currentNarration = state.morningNarration;

  state.phase = 'morning';
  state.dayNumber += 1;

  writePrivateState(room);
  syncMafiaPublicState(room);
}

/** Opens the day's discussion (the morning announcement has already played). */
export function beginMafiaDiscussion(room: InternalRoom): void {
  const state = stateFor(room);
  if (!state) return;
  state.phase = 'day';
  state.readyToVote.clear();
  state.currentNarration = state.morningNarration || state.currentNarration;
  writePrivateState(room);
  syncMafiaPublicState(room);
}

/* ───────────────────────────── Day / vote ───────────────────────────────── */

/** A living player taps "ready to vote". More than half ends discussion early. */
export function markMafiaReadyToVote(
  room: InternalRoom,
  playerId: string
): { accepted: boolean; readyCount: number; livingCount: number; shouldVote: boolean } {
  const state = stateFor(room);
  if (!state || state.phase !== 'day' || !state.alive.has(playerId)) {
    return { accepted: false, readyCount: 0, livingCount: 0, shouldVote: false };
  }

  state.readyToVote.add(playerId);
  writePrivateState(room);
  syncMafiaPublicState(room);

  const readyCount = state.readyToVote.size;
  const livingCount = state.alive.size;
  return {
    accepted: true,
    readyCount,
    livingCount,
    shouldVote: readyCount * 2 > livingCount,
  };
}

/** Opens the secret ballot (votes are hidden until the exile screen). */
export function beginMafiaVote(room: InternalRoom): void {
  const state = stateFor(room);
  if (!state) return;
  state.phase = 'vote';
  state.votes = {};
  state.lastVote = null;
  state.currentNarration = state.morningNarration || state.currentNarration;

  room.hasVoted.clear();
  room.voteTallies = {};
  room.playerVotes = {};

  writePrivateState(room);
  syncMafiaPublicState(room);
}

/** Locks one living player's secret ballot. `'skip'` is a valid ballot. */
export function submitMafiaVote(
  room: InternalRoom,
  voterId: string,
  targetId: string
): { accepted: boolean; complete: boolean; error?: string } {
  const state = stateFor(room);
  if (!state || state.phase !== 'vote') {
    return { accepted: false, complete: false, error: 'Voting is not open.' };
  }
  if (!state.alive.has(voterId)) {
    return { accepted: false, complete: false, error: 'The dead cannot vote.' };
  }
  if (state.votes[voterId]) {
    return { accepted: false, complete: false, error: 'Your vote is already locked in.' };
  }

  if (targetId !== SKIP_VOTE) {
    if (targetId === voterId) {
      return { accepted: false, complete: false, error: 'You cannot vote for yourself.' };
    }
    if (!state.alive.has(targetId)) {
      return { accepted: false, complete: false, error: 'That player is not in the village.' };
    }
  }

  state.votes[voterId] = targetId;

  // Only *who has voted* is public; the running tally and the ballots stay in
  // this module until resolveMafiaExile publishes them on the exile screen.
  room.hasVoted.add(voterId);

  writePrivateState(room);
  syncMafiaPublicState(room);

  return {
    accepted: true,
    complete: Object.keys(state.votes).length >= state.alive.size,
  };
}

export function mafiaVotesPending(room: InternalRoom): number {
  const state = stateFor(room);
  if (!state || state.phase !== 'vote') return 0;
  return Object.keys(state.votes).filter((playerId) => state.alive.has(playerId)).length;
}

/**
 * One bot's secret ballot: a Detective votes a player it has already identified
 * as Mafia, a Mafia bot never votes a teammate, everyone else votes at random.
 */
export function pickMafiaBotVote(room: InternalRoom, playerId: string): string {
  const state = stateFor(room);
  if (!state || !state.alive.has(playerId)) return SKIP_VOTE;

  const role = roleOf(state, playerId);
  const living = getLivingPlayerIds(room);

  if (role === 'detective') {
    const findings = state.investigations[playerId] ?? [];
    const knownMafia = findings
      .filter((finding) => finding.isMafia)
      .map((finding) => room.players.find((entry) => entry.name === finding.targetName)?.id)
      .find((id): id is string => typeof id === 'string' && state.alive.has(id));
    if (knownMafia) return knownMafia;
  }

  const candidates = living.filter((id) => {
    if (id === playerId) return false;
    if (role === 'mafia' && roleOf(state, id) === 'mafia') return false;
    return true;
  });

  if (candidates.length === 0) return SKIP_VOTE;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Locks in every living bot's ballot. Returns how many were submitted. */
export function simulateMafiaBotVotes(room: InternalRoom): number {
  const state = stateFor(room);
  if (!state || state.phase !== 'vote') return 0;

  let voted = 0;
  room.players.forEach((player) => {
    if (!player.isBot) return;
    if (!state.alive.has(player.id)) return;
    if (state.votes[player.id]) return;

    if (submitMafiaVote(room, player.id, pickMafiaBotVote(room, player.id)).accepted) {
      voted += 1;
    }
  });
  return voted;
}

/* ───────────────────────────── Exile ────────────────────────────────────── */

/**
 * Counts the secret ballot, removes the exile (if any), narrates the result and
 * moves to EXILE. Win conditions are checked by the room manager after the
 * exile beat.
 */
export function resolveMafiaExile(room: InternalRoom): VoteOutcome | null {
  const state = stateFor(room);
  if (!state || state.phase !== 'vote') return null;

  const outcome = tallyVote(state.votes, [...state.alive]);
  state.lastVote = outcome;
  state.lastExiledId = outcome.exiledId;

  if (outcome.exiledId) {
    const name = playerName(room, outcome.exiledId) ?? 'A player';
    state.exileNarration =
      state.narration.draw('exile', name) + roleClause(state, outcome.exiledId);
    addDeath(room, state, outcome.exiledId, 'exile');
  } else if (outcome.reason === 'skip') {
    state.exileNarration = 'The village chose to skip. Nobody is exiled today.';
  } else if (outcome.reason === 'tie') {
    state.exileNarration = 'The vote is tied. Nobody is exiled today.';
  } else {
    state.exileNarration = 'No one could agree on a suspect. Nobody is exiled today.';
  }

  const tallyText = Object.entries(outcome.tally)
    .map(([playerId, count]) => `${playerName(room, playerId) ?? 'Player'} ${count}`)
    .join(', ');
  const recapLines: string[] = [
    tallyText || 'No votes were cast.',
  ];
  if (outcome.skipCount > 0) recapLines.push(`Skip: ${outcome.skipCount}.`);
  recapLines.push(
    outcome.exiledId
      ? `${playerName(room, outcome.exiledId)} was exiled.`
      : 'Nobody was exiled.'
  );
  state.recap.push({ kind: 'day', label: `Day ${state.dayNumber}`, lines: recapLines });

  state.phase = 'exile';
  state.currentNarration = state.exileNarration;

  writePrivateState(room);
  syncMafiaPublicState(room);
  return outcome;
}

/* ───────────────────────────── Win / results ────────────────────────────── */

export function checkMafiaWin(room: InternalRoom): MafiaSide | null {
  const state = stateFor(room);
  if (!state) return null;
  return checkWin(state.roles, [...state.alive]);
}

/** Locks in the winner, flips every secret to "over" and narrates the verdict. */
export function setMafiaWinningSide(room: InternalRoom, side: MafiaSide): void {
  const state = stateFor(room);
  if (!state) return;
  if (state.gameOver && state.winningSide) return;

  state.winningSide = side;
  state.gameOver = true;
  state.phase = 'over';

  const verdict = state.narration.draw(side === 'mafia' ? 'mafia-win' : 'town-win');
  state.currentNarration = verdict;
  state.recap.push({ kind: 'day', label: 'Verdict', lines: [verdict] });

  writePrivateState(room);
  syncMafiaPublicState(room);
}

/**
 * Game over: every role is revealed, the winning faction scores +3 and each of its
 * survivors scores +1 more, all through awardPoints().
 */
export function calculateMafiaResults(room: InternalRoom): void {
  const state = stateFor(room);
  if (state?.resultsApplied) return;

  const winningSide: MafiaSide = state?.winningSide ?? checkMafiaWin(room) ?? 'town';
  const eliminations = state?.eliminations ?? [];
  const pointsAwarded: Record<string, number> = {};

  if (state) {
    state.winningSide = winningSide;
    state.gameOver = true;
    state.resultsApplied = true;
    state.phase = 'over';
  }

  room.players.forEach((player) => {
    const role = state ? roleOf(state, player.id) : 'townsperson';
    const survived = state ? state.alive.has(player.id) : true;
    const onWinningSide = sideOf(role) === winningSide;
    const points = onWinningSide
      ? MAFIA_WIN_POINTS + (survived ? MAFIA_SURVIVOR_BONUS : 0)
      : 0;

    pointsAwarded[player.id] = points;
    if (points > 0) awardPoints(room, player.id, points, 'mafia:win');
  });

  const roleReveals: RoleRevealInfo[] = room.players.map((player) => {
    const role = state ? roleOf(state, player.id) : 'townsperson';
    const elimination = eliminations.find((entry) => entry.playerId === player.id);
    const survived = state ? state.alive.has(player.id) : true;
    const investigations = state?.investigations[player.id] ?? [];

    let explanation: string;
    if (elimination?.cause === 'night-kill') {
      explanation = `Eliminated by the Mafia on night ${elimination.night}.`;
    } else if (elimination?.cause === 'exile') {
      explanation = `Exiled by the village on day ${elimination.day ?? elimination.night}.`;
    } else if (survived) {
      explanation = 'Survived the whole game.';
    } else {
      explanation = 'Eliminated during the game.';
    }

    if (role === 'detective' && investigations.length > 0) {
      explanation += ` Investigated ${investigations.length} ${
        investigations.length === 1 ? 'player' : 'players'
      }.`;
    }

    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      role: MAFIA_ROLE_LABELS[role],
      isSpecialRole: role === 'mafia',
      explanation,
    };
  });

  const standings: PlayerResultStanding[] = room.players.map((player) => {
    const role = state ? roleOf(state, player.id) : 'townsperson';
    const survived = state ? state.alive.has(player.id) : true;
    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      pointsAdded: pointsAwarded[player.id] ?? 0,
      totalScore: player.score,
      badge: `${MAFIA_ROLE_LABELS[role]} · ${survived ? 'Survived' : 'Eliminated'}`,
    };
  });

  standings.sort((a, b) => b.totalScore - a.totalScore);

  const winners = room.players.filter(
    (player) => state && sideOf(roleOf(state, player.id)) === winningSide
  );
  const survivorWinners = winners.filter((player) => state?.alive.has(player.id));
  const mafiaNames = room.players
    .filter((player) => state && roleOf(state, player.id) === 'mafia')
    .map((player) => player.name)
    .join(', ');
  const recap = state?.recap ?? [];
  const deaths = eliminations.filter((entry) => entry.cause === 'night-kill').length;
  const exiles = eliminations.filter((entry) => entry.cause === 'exile').length;

  room.results = {
    summary:
      winningSide === 'mafia'
        ? `The Mafia reached parity — the village falls.`
        : `Every Mafia member was rooted out — the village survives!`,
    whyHint:
      winningSide === 'mafia'
        ? `The Mafia was ${mafiaNames}. Each of the ${winners.length} winners scored ${MAFIA_WIN_POINTS}, and ${
            survivorWinners.length
          } ${survivorWinners.length === 1 ? 'survivor' : 'survivors'} gained +${MAFIA_SURVIVOR_BONUS}.`
        : `The Mafia was ${mafiaNames}. Each of the ${winners.length} winners scored ${MAFIA_WIN_POINTS}, and ${
            survivorWinners.length
          } ${survivorWinners.length === 1 ? 'survivor' : 'survivors'} gained +${MAFIA_SURVIVOR_BONUS}.`,
    category: 'Mafia',
    roleReveals,
    standings,
    winnerTitle: winningSide === 'mafia' ? 'Mafia Wins' : 'Town Wins',
    mafiaWinningSide: winningSide,
    mafiaLog: recap.flatMap((entry) => `${entry.label}: ${entry.lines.join(' ')}`),
    mafiaRecap: recap,
    mafiaEliminations: eliminations,
    mafiaDeathCount: deaths,
    mafiaExileCount: exiles,
  };

  syncMafiaPublicState(room);
}

/* ───────────────────────────── Housekeeping ─────────────────────────────── */

/**
 * Internal helper so every mutation refreshes the player's own view. Kept small
 * because callers always follow it with a public sync.
 */
function writePrivateState(room: InternalRoom): void {
  syncMafiaPrivateState(room);
}
