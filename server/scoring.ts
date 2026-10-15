/**
 * Central scoring.
 *
 * awardPoints() is the ONLY place individual scores change. Every game module
 * (and every game written later) awards through it, so solo totals and team
 * totals can never drift apart: in team mode the same award rolls up to the
 * player's team. See docs/GAME_rules.md → "Adding a game".
 */

import { PlayMode, Team } from '../shared/types';

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
  teams?: Team[];
  scoreLog?: ScoreLogEntry[];
}

/** Debug/audit trail of every award this room has made (bounded, in memory). */
export interface ScoreLogEntry {
  playerId: string;
  playerName: string;
  points: number;
  reason: string;
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

  if (room.scoreLog) {
    room.scoreLog.push({
      playerId: player.id,
      playerName: (player as { name?: string }).name || player.id,
      points: amount,
      reason: reason || 'round',
    });
    if (room.scoreLog.length > SCORE_LOG_LIMIT) {
      room.scoreLog.splice(0, room.scoreLog.length - SCORE_LOG_LIMIT);
    }
  }

  return player.score;
}
