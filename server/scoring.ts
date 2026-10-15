/**
 * Central scoring.
 *
 * awardPoints() is the ONLY place individual scores change. Every game module
 * (and every game written later) awards through it, so solo totals and team
 * totals can never drift apart: in team mode the same award rolls up to the
 * player's team. See docs/GAME_rules.md → "Adding a game".
 */

import { PlayMode } from '../shared/types';

/** Minimal structural shape of a player for scoring (InternalPlayer matches). */
export interface ScorablePlayer {
  id: string;
  score: number;
  teamId?: string;
}

/** Minimal structural shape of a room for scoring (InternalRoom matches). */
export interface ScorableRoom {
  players: ScorablePlayer[];
  playMode?: PlayMode;
  teams?: ScorableTeam[];
  scoreLog?: ScoreLogEntry[];
}

/** Debug/audit trail of every award this room has made (bounded, in memory). */
export interface ScoreLogEntry {
  playerId: string;
  playerName: string;
  points: number;
  reason: string;
}

/** Minimal structural shape of a team for team-only scoring (Team matches). */
export interface ScorableTeam {
  id: string;
  score: number;
  memberIds: string[];
  bonusPoints?: number;
}

const SCORE_LOG_LIMIT = 200;

/**
 * Awards `points` to a player and, in team mode, to that player's team.
 * Returns the player's new individual total (0 when the player is unknown).
 */
export function awardPoints(
  room: ScorableRoom,
  playerId: string,
  points: number,
  reason?: string
): number {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return 0;

  const amount = Number.isFinite(points) ? Math.round(points) : 0;
  player.score += amount;

  if (room.playMode === 'team' && player.teamId && room.teams) {
    const team = room.teams.find((t) => t.id === player.teamId);
    if (team) team.score += amount;
  }

  logScore(room, player.id, (player as { name?: string }).name || player.id, amount, reason);
  return player.score;
}

/** Sum of a team's member scores — the part of a total that is always derived. */
function memberScoreSum(room: ScorableRoom, team: ScorableTeam): number {
  return room.players
    .filter((player) => player.teamId === team.id)
    .reduce((sum, player) => sum + player.score, 0);
}

/**
 * Awards `points` to a TEAM only, leaving every member's individual score alone.
 *
 * Games with native team rules (Top 100: one guess per team) score the team, not
 * the players. The award is stored as the team's `bonusPoints` so the derived
 * total (`members + bonusPoints`) survives a membership change or a recompute.
 * Returns the team's new total (0 when the team is unknown).
 */
export function awardTeamPoints(
  room: ScorableRoom,
  teamId: string,
  points: number,
  reason?: string
): number {
  const team = room.teams?.find((candidate) => candidate.id === teamId);
  if (!team) return 0;

  const amount = Number.isFinite(points) ? Math.round(points) : 0;
  const bonus = (team.bonusPoints ?? 0) + amount;
  team.bonusPoints = bonus;
  team.score = memberScoreSum(room, team) + bonus;

  logScore(room, team.id, (team as { name?: string }).name || team.id, amount, reason);
  return team.score;
}

/**
 * Recomputes every team total from its members plus any team-only awards.
 * Membership changes (a player switching teams) must never lose bonus points.
 */
export function recomputeTeamScores(room: ScorableRoom): void {
  room.teams?.forEach((team) => {
    team.score = memberScoreSum(room, team) + (team.bonusPoints ?? 0);
  });
}

function logScore(
  room: ScorableRoom,
  id: string,
  name: string,
  amount: number,
  reason?: string
): void {
  if (!room.scoreLog) return;
  room.scoreLog.push({ playerId: id, playerName: name, points: amount, reason: reason || 'round' });
  if (room.scoreLog.length > SCORE_LOG_LIMIT) {
    room.scoreLog.splice(0, room.scoreLog.length - SCORE_LOG_LIMIT);
  }
}
