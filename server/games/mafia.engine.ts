/**
 * Mafia — pure rules engine.
 *
 * Everything that decides an outcome lives here as a pure function: no room, no
 * globals, no clock, and randomness is injected (defaulting to Math.random) so
 * the test suite can force ties and deals deterministically.
 *
 * The room-aware layer (server/games/mafia.ts) owns the secret per-room state and
 * calls these helpers; the client only ever sees what that layer publishes.
 */

import {
  MafiaRole,
  MafiaRoleBreakdown,
  MafiaSettings,
  MafiaSide,
} from '../../shared/types';
import { roleBreakdown } from '../../shared/data/mafiaSetup';

/**
 * Deal math and settings validation live in shared/data/mafiaSetup.ts so the host
 * UI and the server enforce byte-for-byte the same rules. They are re-exported
 * here because this module is the engine's single entry point.
 */
export {
  autoMafiaCount,
  maxMafiaCount,
  resolveMafiaCount,
  dealSpecials,
  roleBreakdown,
  validateMafiaSettings,
  validateMafiaSettings as validateSettings,
} from '../../shared/data/mafiaSetup';

export type Rng = () => number;

/** Fisher–Yates shuffle into a new array (never mutates the input). */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}



export interface MafiaDeal {
  roles: Record<string, MafiaRole>;
  mafiaIds: string[];
  breakdown: MafiaRoleBreakdown;
}

/**
 * Random secret deal. Roles are assigned from a shuffled copy of the player ids,
 * so assignment is uniform and never depends on join order.
 */
export function assignRoles(
  playerIds: readonly string[],
  settings: MafiaSettings,
  rng: Rng = Math.random
): MafiaDeal {
  const breakdown = roleBreakdown(playerIds.length, settings);
  const order = shuffle(playerIds, rng);
  const roles: Record<string, MafiaRole> = {};

  order.forEach((playerId, index) => {
    if (index < breakdown.mafia) {
      roles[playerId] = 'mafia';
    } else if (breakdown.detective && index === breakdown.mafia) {
      roles[playerId] = 'detective';
    } else if (breakdown.doctor && index === breakdown.mafia + (breakdown.detective ? 1 : 0)) {
      roles[playerId] = 'doctor';
    } else {
      roles[playerId] = 'townsperson';
    }
  });

  return {
    roles,
    mafiaIds: order.filter((playerId) => roles[playerId] === 'mafia'),
    breakdown,
  };
}

export interface NightActions {
  /** mafiaId → victim playerId. Missing entries mean that member abstained. */
  mafiaTargets: Record<string, string>;
  /** doctorId’s choice for the night (null/absent = no protection). */
  doctorTarget?: string | null;
  /** detectiveId’s choice for the night (null/absent = no investigation). */
  detectiveTarget?: string | null;
}

export interface NightInput {
  roles: Record<string, MafiaRole>;
  /** Living players *before* the night resolves. */
  alive: readonly string[];
  night: number;
  /** The Doctor may not protect the same player two nights in a row. */
  doctorLastProtected: string | null;
  actions: NightActions;
}

export interface NightResolution {
  /** The majority victim the Mafia agreed on (null when nobody voted). */
  mafiaTargetId: string | null;
  /** The Doctor’s legal protection for the night. */
  doctorTargetId: string | null;
  /** The protection landed on the Mafia’s target. Never announced publicly. */
  saved: boolean;
  /** Who actually died (null when nobody did). */
  victimId: string | null;
  /** The Detective’s private result, null when they died or did not investigate. */
  detective: { targetId: string; isMafia: boolean } | null;
}

/**
 * Resolves one night:
 *  - the victim is the player with the most Mafia votes (ties broken at random);
 *  - no Mafia vote means no attack;
 *  - the Doctor’s legal protection cancels that attack;
 *  - the Detective learns their target’s side, unless they are the one who died.
 */
export function resolveNight(input: NightInput, rng: Rng = Math.random): NightResolution {
  const alive = new Set(input.alive);

  const mafiaVotes: string[] = [];
  for (const [playerId, role] of Object.entries(input.roles)) {
    if (role !== 'mafia' || !alive.has(playerId)) continue;
    const target = input.actions.mafiaTargets[playerId];
    // A Mafia member may not target their own family, and only the living can die.
    if (!target || !alive.has(target)) continue;
    if (input.roles[target] === 'mafia') continue;
    mafiaVotes.push(target);
  }

  let mafiaTargetId: string | null = null;
  if (mafiaVotes.length > 0) {
    const tally = new Map<string, number>();
    mafiaVotes.forEach((target) => tally.set(target, (tally.get(target) ?? 0) + 1));
    const top = Math.max(...tally.values());
    const tied = [...tally.entries()]
      .filter(([, count]) => count === top)
      .map(([target]) => target);
    mafiaTargetId = tied.length === 1 ? tied[0] : tied[Math.floor(rng() * tied.length)];
  }

  let doctorTargetId: string | null = null;
  const doctorId = Object.keys(input.roles).find(
    (playerId) => input.roles[playerId] === 'doctor' && alive.has(playerId)
  );
  const requestedProtection = input.actions.doctorTarget ?? null;
  if (
    doctorId &&
    requestedProtection &&
    alive.has(requestedProtection) &&
    requestedProtection !== input.doctorLastProtected
  ) {
    doctorTargetId = requestedProtection;
  }

  const saved = Boolean(mafiaTargetId && doctorTargetId && mafiaTargetId === doctorTargetId);
  const victimId = mafiaTargetId && !saved ? mafiaTargetId : null;

  let detective: NightResolution['detective'] = null;
  const detectiveId = Object.keys(input.roles).find(
    (playerId) => input.roles[playerId] === 'detective' && alive.has(playerId)
  );
  const investigation = input.actions.detectiveTarget ?? null;
  // A Detective killed tonight takes their new finding with them.
  if (detectiveId && victimId !== detectiveId && investigation && alive.has(investigation)) {
    detective = {
      targetId: investigation,
      isMafia: input.roles[investigation] === 'mafia',
    };
  }

  return { mafiaTargetId, doctorTargetId, saved, victimId, detective };
}

export const SKIP_VOTE = 'skip';

export interface VoteOutcome {
  /** Player target → votes. Skip ballots are counted separately. */
  tally: Record<string, number>;
  skipCount: number;
  topCount: number;
  exiledId: string | null;
  reason: 'plurality' | 'tie' | 'skip' | 'no-votes';
}

/**
 * Counts the secret ballot:
 *  - only living players vote;
 *  - a plurality exiles that player;
 *  - any tie for first, or Skip first/tied for first, exiles nobody.
 */
export function tallyVote(
  votes: Record<string, string>,
  alive: readonly string[]
): VoteOutcome {
  const living = new Set(alive);
  const tally: Record<string, number> = {};
  let skipCount = 0;

  Object.entries(votes).forEach(([voterId, targetId]) => {
    if (!living.has(voterId)) return;
    if (targetId === SKIP_VOTE) {
      skipCount += 1;
      return;
    }
    if (!living.has(targetId)) return;
    tally[targetId] = (tally[targetId] || 0) + 1;
  });

  const playerCounts = Object.values(tally);
  const topCount = playerCounts.length > 0 ? Math.max(...playerCounts) : 0;

  if (topCount === 0) {
    return { tally, skipCount, topCount, exiledId: null, reason: 'no-votes' };
  }

  if (skipCount >= topCount) {
    return { tally, skipCount, topCount, exiledId: null, reason: 'skip' };
  }

  const topTargets = Object.keys(tally).filter((targetId) => tally[targetId] === topCount);
  if (topTargets.length !== 1) {
    return { tally, skipCount, topCount, exiledId: null, reason: 'tie' };
  }

  return { tally, skipCount, topCount, exiledId: topTargets[0], reason: 'plurality' };
}

export interface SideCounts {
  mafia: number;
  town: number;
}

export function countSides(
  roles: Record<string, MafiaRole>,
  alive: readonly string[]
): SideCounts {
  const living = new Set(alive);
  let mafia = 0;
  let town = 0;
  living.forEach((playerId) => {
    if (roles[playerId] === 'mafia') mafia += 1;
    else town += 1;
  });
  return { mafia, town };
}

/**
 * Win check, in the documented order:
 *  1. Town wins when no Mafia remain alive.
 *  2. Mafia wins once they are at least as numerous as everyone else alive.
 */
export function checkWin(
  roles: Record<string, MafiaRole>,
  alive: readonly string[]
): MafiaSide | null {
  const counts = countSides(roles, alive);
  if (counts.mafia === 0) return 'town';
  if (counts.mafia >= counts.town) return 'mafia';
  return null;
}

/** Side of a role, for scoring and reveal copy. */
export function sideOf(role: MafiaRole): MafiaSide {
  return role === 'mafia' ? 'mafia' : 'town';
}
