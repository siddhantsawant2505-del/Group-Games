/**
 * Mafia Game Module.
 * Server-authoritative logic for role assignment, night actions
 * (Mafia kill + Detective investigation), exile trials, win detection,
 * and per-game scoring.
 *
 * Flow: reveal -> night -> day -> discussion -> vote -> (night | results)
 */

import { InternalRoom } from '../roomManager';
import {
  MafiaElimination,
  MafiaInvestigation,
  MafiaPublicState,
  MafiaRole,
  MafiaSide,
  MafiaTeamSelection,
  PlayerResultStanding,
  RoleRevealInfo,
} from '../../shared/types';

/** Seconds the town sleeps while Mafia and the Detective make their moves. */
export const MAFIA_NIGHT_SECONDS = 30;

/** Seconds the morning report stays on screen before the town gathers. */
export const MAFIA_DAY_SECONDS = 12;

/** Roughly one Mafia per four players, always at least one. */
const PLAYERS_PER_MAFIA = 4;

/** The Detective is dealt from four players upwards. */
const DETECTIVE_MIN_PLAYERS = 4;

/** Chance a bot Mafia picks the same victim as its teammate. */
const BOT_TEAMMATE_AGREEMENT = 0.6;

export interface MafiaRoundState {
  roles: Record<string, MafiaRole>;
  alive: Set<string>;
  nightNumber: number;
  dayNumber: number;
  /** actorPlayerId -> chosen targetPlayerId for the current night */
  nightTargets: Record<string, string>;
  investigations: Record<string, MafiaInvestigation[]>;
  lastNightVictimId: string | null;
  lastExiledId: string | null;
  eliminations: MafiaElimination[];
  winningSide: MafiaSide | null;
  gameOver: boolean;
  log: string[];
}

// In-memory store of active Mafia game details per room
const activeRounds = new Map<string, MafiaRoundState>();

/**
 * Shuffles an array in-place using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getMafiaRoundState(roomCode: string): MafiaRoundState | undefined {
  return activeRounds.get(roomCode);
}

export function getMafiaRoleLabel(role: MafiaRole): string {
  if (role === 'mafia') return 'The Mafia';
  if (role === 'detective') return 'The Detective';
  return 'Townsperson';
}

/** Every player assigned to the Mafia this game (alive or not). */
export function getMafiaIds(room: InternalRoom): string[] {
  const state = activeRounds.get(room.code);
  if (!state) return [];
  return Object.entries(state.roles)
    .filter(([, role]) => role === 'mafia')
    .map(([playerId]) => playerId);
}

/** Living players in room order. */
export function getLivingPlayerIds(room: InternalRoom): string[] {
  const state = activeRounds.get(room.code);
  if (!state) return room.players.map((p) => p.id);
  return room.players.filter((p) => state.alive.has(p.id)).map((p) => p.id);
}

export function isPlayerAlive(room: InternalRoom, playerId: string): boolean {
  const state = activeRounds.get(room.code);
  if (!state) return true;
  return state.alive.has(playerId);
}

/** Alive Mafia and Detective who still owe a night action. */
function nightActors(state: MafiaRoundState): string[] {
  return Object.entries(state.roles)
    .filter(([playerId, role]) => state.alive.has(playerId) && (role === 'mafia' || role === 'detective'))
    .map(([playerId]) => playerId);
}

function pendingNightActions(state: MafiaRoundState): number {
  return nightActors(state).filter((playerId) => !state.nightTargets[playerId]).length;
}

/** Public state mirrored onto the room so every client can render the night. */
export function syncMafiaPublicState(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) {
    room.mafiaState = null;
    return;
  }

  const publicState: MafiaPublicState = {
    nightNumber: state.nightNumber,
    dayNumber: state.dayNumber,
    mafiaCount: getMafiaIds(room).length,
    hasDetective: Object.values(state.roles).includes('detective'),
    alivePlayerIds: getLivingPlayerIds(room),
    eliminatedIds: state.eliminations.map((e) => e.playerId),
    eliminations: state.eliminations,
    lastNightVictimId: state.lastNightVictimId,
    lastNightVictimName: playerName(room, state.lastNightVictimId),
    lastExiledId: state.lastExiledId,
    lastExiledName: playerName(room, state.lastExiledId),
    pendingNightActions: pendingNightActions(state),
    nightSeconds: MAFIA_NIGHT_SECONDS,
    daySeconds: MAFIA_DAY_SECONDS,
    winningSide: state.winningSide,
    gameOver: state.gameOver,
  };

  room.mafiaState = publicState;
}

function playerName(room: InternalRoom, playerId: string | null): string | null {
  if (!playerId) return null;
  return room.players.find((p) => p.id === playerId)?.name || null;
}

/**
 * Writes each player's private role card. Only the owner ever sees it.
 */
function writePrivateRoles(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  const mafiaNames = getMafiaIds(room).map(
    (id) => room.players.find((p) => p.id === id)?.name || 'Player'
  );

  room.privateData = {};

  room.players.forEach((player) => {
    const role = state.roles[player.id] || 'townsperson';
    const isMafia = role === 'mafia';
    const isDetective = role === 'detective';

    let instructions: string;
    if (isMafia) {
      instructions =
        mafiaNames.length > 1
          ? `You are the Mafia with ${mafiaNames
              .filter((name) => name !== player.name)
              .join(', ')}. Each night the family picks one victim — during the day you are an innocent face in the crowd.`
          : 'You are the lone Mafia. Each night you pick one victim — during the day you are an innocent face in the crowd.';
    } else if (isDetective) {
      instructions =
        'Each night you may investigate one player and learn whether they are Mafia. Use your findings carefully — the Mafia will come for you.';
    } else {
      instructions =
        'You have no night action. Watch, listen, and vote out the Mafia before they outnumber the town.';
    }

    room.privateData[player.id] = {
      role: getMafiaRoleLabel(role),
      isSpecialRole: isMafia,
      specialAccentBg: isMafia,
      mafiaRole: role,
      mafiaRoleLabel: getMafiaRoleLabel(role),
      mafiaIsAlive: true,
      mafiaTeammateNames: isMafia
        ? mafiaNames.filter((name) => name !== player.name)
        : undefined,
      mafiaTeammateIds: isMafia
        ? getMafiaIds(room).filter((id) => id !== player.id)
        : undefined,
      mafiaInvestigations: isDetective ? [] : undefined,
      mafiaCanAct: false,
      mafiaActionSubmitted: false,
      mafiaActionTargetName: null,
      secretInstructions: instructions,
    };
  });
}

/**
 * 1. Role Assignment (reveal phase)
 * Roughly 1 Mafia per 4 players (minimum 1), an optional Detective, rest Townspeople.
 */
export function setupMafiaRound(room: InternalRoom): void {
  const players = room.players;
  const mafiaCount = Math.max(1, Math.floor(players.length / PLAYERS_PER_MAFIA));
  const hasDetective = players.length >= DETECTIVE_MIN_PLAYERS;

  const shuffled = shuffleArray(players.map((p) => p.id));
  const roles: Record<string, MafiaRole> = {};
  const alive = new Set(players.map((p) => p.id));

  shuffled.forEach((playerId, index) => {
    if (index < mafiaCount) {
      roles[playerId] = 'mafia';
    } else if (hasDetective && index === mafiaCount) {
      roles[playerId] = 'detective';
    } else {
      roles[playerId] = 'townsperson';
    }
  });

  activeRounds.set(room.code, {
    roles,
    alive,
    nightNumber: 0,
    dayNumber: 0,
    nightTargets: {},
    investigations: {},
    lastNightVictimId: null,
    lastExiledId: null,
    eliminations: [],
    winningSide: null,
    gameOver: false,
    log: [],
  });

  writePrivateRoles(room);
  syncMafiaPublicState(room);

  room.phasePrompt = 'Read Your Secret Role';
  room.phaseSubprompt = 'Keep your screen hidden from everyone else!';
}

/**
 * 2. Night start
 * Resets the night slate, wakes up Mafia and the Detective, and clears the
 * morning report so the previous night's victim is not shown again.
 */
export function beginMafiaNight(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  state.nightNumber += 1;
  state.nightTargets = {};
  state.lastNightVictimId = null;

  room.players.forEach((player) => {
    const priv = room.privateData[player.id];
    if (!priv) return;

    const alive = state.alive.has(player.id);
    const role = state.roles[player.id] || 'townsperson';
    const canAct = alive && (role === 'mafia' || role === 'detective');

    priv.mafiaIsAlive = alive;
    priv.mafiaCanAct = canAct;
    priv.mafiaActionSubmitted = false;
    priv.mafiaActionTargetName = null;
    priv.mafiaActionLabel =
      role === 'mafia' ? 'Choose a victim' : role === 'detective' ? 'Choose someone to investigate' : undefined;

    if (role === 'mafia') {
      priv.mafiaTeamSelections = buildTeamSelections(room, state, player.id);
    }
  });

  syncMafiaPublicState(room);
}

function buildTeamSelections(
  room: InternalRoom,
  state: MafiaRoundState,
  viewerId: string
): MafiaTeamSelection[] {
  return getMafiaIds(room).map((mafiaId) => {
    const targetId = state.nightTargets[mafiaId] || null;
    return {
      playerName: room.players.find((p) => p.id === mafiaId)?.name || 'Mafia',
      targetName: mafiaId === viewerId
        ? null
        : targetId
        ? room.players.find((p) => p.id === targetId)?.name || null
        : null,
    };
  });
}

/**
 * Refreshes the Mafia team view of who has locked in which victim.
 */
function refreshTeamSelections(room: InternalRoom, state: MafiaRoundState): void {
  getMafiaIds(room).forEach((mafiaId) => {
    const priv = room.privateData[mafiaId];
    if (!priv) return;
    priv.mafiaTeamSelections = buildTeamSelections(room, state, mafiaId);
  });
}

/**
 * 3. Night action
 * Mafia pick a victim, the Detective picks someone to investigate. The
 * Detective learns the result immediately and privately.
 */
export function submitMafiaNightAction(
  room: InternalRoom,
  playerId: string,
  targetPlayerId: string
): { accepted: boolean; complete: boolean; investigation?: MafiaInvestigation } {
  const state = activeRounds.get(room.code);
  if (!state) return { accepted: false, complete: false };

  const role = state.roles[playerId];
  if (!role || (role !== 'mafia' && role !== 'detective')) return { accepted: false, complete: false };
  if (!state.alive.has(playerId)) return { accepted: false, complete: false };

  const target = room.players.find((p) => p.id === targetPlayerId);
  if (!target || !state.alive.has(targetPlayerId)) return { accepted: false, complete: false };
  if (targetPlayerId === playerId) return { accepted: false, complete: false };
  // The family never votes to kill one of its own.
  if (role === 'mafia' && state.roles[targetPlayerId] === 'mafia') return { accepted: false, complete: false };

  state.nightTargets[playerId] = targetPlayerId;

  const priv = room.privateData[playerId] || (room.privateData[playerId] = {});
  priv.mafiaActionSubmitted = true;
  priv.mafiaActionTargetName = target.name;

  let investigation: MafiaInvestigation | undefined;

  if (role === 'detective') {
    investigation = {
      night: state.nightNumber,
      targetName: target.name,
      isMafia: state.roles[targetPlayerId] === 'mafia',
    };

    if (!state.investigations[playerId]) state.investigations[playerId] = [];
    state.investigations[playerId].push(investigation);
    priv.mafiaInvestigations = [...state.investigations[playerId]];

    state.log.push(
      `Night ${state.nightNumber}: the Detective investigated ${target.name}.`
    );
  } else {
    state.log.push(`Night ${state.nightNumber}: the Mafia picked a victim.`);
    refreshTeamSelections(room, state);
  }

  syncMafiaPublicState(room);

  return {
    accepted: true,
    complete: pendingNightActions(state) === 0,
    investigation,
  };
}

/**
 * Automatically resolves night actions for simulated bot players.
 */
export function simulateMafiaBotNightActions(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  const living = getLivingPlayerIds(room);

  room.players.forEach((player) => {
    if (!player.isBot) return;

    const role = state.roles[player.id];
    if (role !== 'mafia' && role !== 'detective') return;
    if (!state.alive.has(player.id)) return;
    if (state.nightTargets[player.id]) return;

    if (role === 'mafia') {
      // Bots try to follow a teammate's pick before choosing their own victim.
      const teammates = getMafiaIds(room).filter((id) => id !== player.id);
      const teammatePick = teammates
        .map((id) => state.nightTargets[id])
        .find((targetId): targetId is string => Boolean(targetId));

      const candidates = living.filter(
        (id) => id !== player.id && state.roles[id] !== 'mafia'
      );
      if (candidates.length === 0) return;

      const target =
        teammatePick && Math.random() < BOT_TEAMMATE_AGREEMENT
          ? teammatePick
          : candidates[Math.floor(Math.random() * candidates.length)];

      submitMafiaNightAction(room, player.id, target);
      return;
    }

    const candidates = living.filter((id) => id !== player.id);
    if (candidates.length === 0) return;
    submitMafiaNightAction(
      room,
      player.id,
      candidates[Math.floor(Math.random() * candidates.length)]
    );
  });
}

export function nightActionsPending(room: InternalRoom): number {
  const state = activeRounds.get(room.code);
  if (!state) return 0;
  return pendingNightActions(state);
}

/**
 * 4. Night resolution
 * The Mafia's victim is decided by majority (ties broken at random) and the
 * town wakes up to the news.
 */
export function resolveMafiaNight(room: InternalRoom): string | null {
  const state = activeRounds.get(room.code);
  if (!state) return null;

  const mafiaVotes = getMafiaIds(room)
    .filter((id) => state.alive.has(id))
    .map((id) => state.nightTargets[id])
    .filter((targetId): targetId is string => Boolean(targetId));

  if (mafiaVotes.length === 0) {
    state.lastNightVictimId = null;
    state.log.push(`Night ${state.nightNumber}: the Mafia struck no one.`);
    syncMafiaPublicState(room);
    return null;
  }

  const tally: Record<string, number> = {};
  mafiaVotes.forEach((targetId) => {
    tally[targetId] = (tally[targetId] || 0) + 1;
  });

  const topCount = Math.max(...Object.values(tally));
  const topTargets = Object.keys(tally).filter((id) => tally[id] === topCount);
  const victimId = topTargets[Math.floor(Math.random() * topTargets.length)];

  eliminatePlayer(room, state, victimId, 'night-kill');
  state.lastNightVictimId = victimId;

  const victimName = room.players.find((p) => p.id === victimId)?.name || 'a player';
  state.log.push(`Night ${state.nightNumber}: ${victimName} was eliminated overnight.`);

  syncMafiaPublicState(room);
  return victimId;
}

function eliminatePlayer(
  room: InternalRoom,
  state: MafiaRoundState,
  playerId: string,
  cause: MafiaElimination['cause']
): void {
  if (!state.alive.has(playerId)) return;

  state.alive.delete(playerId);
  const player = room.players.find((p) => p.id === playerId);
  state.eliminations.push({
    playerId,
    playerName: player?.name || 'Player',
    night: state.nightNumber,
    cause,
  });

  const priv = room.privateData[playerId];
  if (priv) {
    priv.mafiaIsAlive = false;
    priv.mafiaCanAct = false;
  }
}

/**
 * 5. Day start (morning report)
 */
export function beginMafiaDay(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  state.dayNumber += 1;
  syncMafiaPublicState(room);
}

/**
 * 6. Exile trial
 * The existing discussion + vote phases decide who leaves the town today.
 * Ties mean nobody is exiled. Roles stay secret until the final reveal.
 */
export function resolveMafiaExile(room: InternalRoom): string | null {
  const state = activeRounds.get(room.code);
  if (!state) return null;

  const tally: Record<string, number> = {};
  for (const [voterId, targetId] of Object.entries(room.playerVotes)) {
    if (!state.alive.has(voterId)) continue; // the dead do not vote
    if (!state.alive.has(targetId)) continue; // and the dead cannot be exiled
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  const counts = Object.values(tally);
  const topCount = counts.length > 0 ? Math.max(...counts) : 0;
  const topTargets = Object.keys(tally).filter((id) => tally[id] === topCount);

  state.lastExiledId = null;

  if (topCount === 0 || topTargets.length !== 1) {
    state.log.push(
      `Day ${state.dayNumber}: the town could not agree on an exile.`
    );
    syncMafiaPublicState(room);
    return null;
  }

  const exiledId = topTargets[0];
  eliminatePlayer(room, state, exiledId, 'exile');
  state.lastExiledId = exiledId;

  const exiledName = room.players.find((p) => p.id === exiledId)?.name || 'a player';
  state.log.push(`Day ${state.dayNumber}: the town exiled ${exiledName}.`);

  syncMafiaPublicState(room);
  return exiledId;
}

/**
 * 7. Win condition
 * Mafia win once they match the remaining townspeople; the town wins when
 * every Mafia member is gone.
 */
export function checkMafiaWin(room: InternalRoom): MafiaSide | null {
  const state = activeRounds.get(room.code);
  if (!state) return null;

  const aliveMafia = getMafiaIds(room).filter((id) => state.alive.has(id)).length;
  const aliveTownspeople = getLivingPlayerIds(room).length - aliveMafia;

  if (aliveMafia === 0) return 'town';
  if (aliveMafia >= aliveTownspeople) return 'mafia';
  return null;
}

/** Locks in the winning side and marks the game as over. */
export function setMafiaWinningSide(room: InternalRoom, side: MafiaSide): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  state.winningSide = side;
  state.gameOver = true;
  state.log.push(
    side === 'mafia'
      ? `The Mafia reached parity and took the town.`
      : `Every Mafia member was rooted out — the town survives.`
  );
  syncMafiaPublicState(room);
}

/** Living bots cast a simple vote for a living suspect. */
export function simulateMafiaBotVotes(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  if (!state) return;

  const living = getLivingPlayerIds(room);

  room.players.forEach((player) => {
    if (!player.isBot) return;
    if (!state.alive.has(player.id)) return;
    if (room.hasVoted.has(player.id)) return;

    const isMafiaBot = state.roles[player.id] === 'mafia';
    const candidates = living.filter(
      (id) => id !== player.id && (!isMafiaBot || state.roles[id] !== 'mafia')
    );
    if (candidates.length === 0) return;

    const target = candidates[Math.floor(Math.random() * candidates.length)];
    room.hasVoted.add(player.id);
    room.playerVotes[player.id] = target;
    room.voteTallies[target] = (room.voteTallies[target] || 0) + 1;

    if (!room.privateData[player.id]) room.privateData[player.id] = {};
    room.privateData[player.id].voteSubmitted = true;
    room.privateData[player.id].votedForPlayerId = target;
  });
}

/**
 * 8. Final results
 * Full role reveal, the winning side, and +1 for every surviving member of the
 * winning side.
 */
export function calculateMafiaResults(room: InternalRoom): void {
  const state = activeRounds.get(room.code);
  const winningSide = state?.winningSide || 'town';
  const eliminations = state?.eliminations || [];

  const pointsAwarded: Record<string, number> = {};
  room.players.forEach((player) => {
    pointsAwarded[player.id] = 0;
  });

  room.players.forEach((player) => {
    const role = state?.roles[player.id] || 'townsperson';
    const survived = state?.alive.has(player.id) ?? true;
    const onWinningSide =
      winningSide === 'mafia' ? role === 'mafia' : role !== 'mafia';

    if (onWinningSide && survived) {
      pointsAwarded[player.id] = 1;
      player.score += 1;
    }
  });

  const roleReveals: RoleRevealInfo[] = room.players.map((player) => {
    const role = state?.roles[player.id] || 'townsperson';
    const elimination = eliminations.find((e) => e.playerId === player.id);
    const survived = state?.alive.has(player.id) ?? true;

    let explanation: string;
    if (elimination?.cause === 'night-kill') {
      explanation = `Eliminated by the Mafia on night ${elimination.night}.`;
    } else if (elimination?.cause === 'exile') {
      explanation = `Exiled by the town on day ${elimination.night}.`;
    } else if (survived) {
      explanation = 'Survived the whole game.';
    } else {
      explanation = 'Eliminated during the game.';
    }

    const investigations = state?.investigations[player.id] || [];
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
      role: getMafiaRoleLabel(role),
      isSpecialRole: role === 'mafia',
      explanation,
    };
  });

  const standings: PlayerResultStanding[] = room.players.map((player) => {
    const role = state?.roles[player.id] || 'townsperson';
    const survived = state?.alive.has(player.id) ?? true;
    const onWinningSide = winningSide === 'mafia' ? role === 'mafia' : role !== 'mafia';

    return {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.colorHex,
      colorIndex: player.colorIndex,
      pointsAdded: pointsAwarded[player.id] || 0,
      totalScore: player.score,
      badge: survived ? 'Survived' : 'Eliminated',
    };
  });

  standings.sort((a, b) => b.totalScore - a.totalScore);

  const mafiaNames = getMafiaIds(room)
    .map((id) => room.players.find((p) => p.id === id)?.name || 'Player')
    .join(', ');

  const survivorsOnWinningSide = standings.filter((s) => s.pointsAdded > 0).length;

  room.results = {
    summary:
      winningSide === 'mafia'
        ? `The Mafia reached parity — the town falls.`
        : `Every Mafia member was eliminated — the town survives!`,
    whyHint:
      winningSide === 'mafia'
        ? `The Mafia was ${mafiaNames}. ${survivorsOnWinningSide} surviving ${
            survivorsOnWinningSide === 1 ? 'member' : 'members'
          } scored +1 point.`
        : `The Mafia was ${mafiaNames}. ${
            survivorsOnWinningSide === 1 ? 'One' : survivorsOnWinningSide
          } surviving ${survivorsOnWinningSide === 1 ? 'townsperson' : 'townspeople'} scored +1 point.`,
    category: 'Mafia',
    roleReveals,
    standings,
    winnerTitle: winningSide === 'mafia' ? 'Mafia Wins' : 'Town Wins',
    mafiaWinningSide: winningSide,
    mafiaLog: state?.log || [],
    mafiaEliminations: eliminations,
  };
}

/**
 * Cleans up active game state when a room returns to the lobby
 */
export function cleanupMafiaRound(roomCode: string): void {
  activeRounds.delete(roomCode);
}
