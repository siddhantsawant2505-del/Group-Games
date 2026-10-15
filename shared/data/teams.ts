/**
 * Room team-mode defaults and helpers, shared by the server (team creation,
 * balancing) and the client (lobby preview, start gating).
 */

import { MAX_TEAMS, MIN_TEAMS, PlayMode, Team } from '../types';

export interface TeamTemplate {
  name: string;
  icon: string;
}

/**
 * Default team identities, assigned in order as the host adds teams. Every team
 * gets an icon as well as an accent slot so it is identifiable without colour.
 */
export const TEAM_TEMPLATES: readonly TeamTemplate[] = [
  { name: 'Comets', icon: '☄️' },
  { name: 'Foxes', icon: '🦊' },
  { name: 'Otters', icon: '🦦' },
  { name: 'Falcons', icon: '🦅' },
] as const;

export const DEFAULT_TEAM_COUNT = 2;

export const TEAM_NAME_MAX_CHARS = 20;

/**
 * Normalizes a host-authored team name: trims, collapses whitespace, strips
 * control characters and caps the length. Falls back to the template name.
 */
export function sanitizeTeamName(raw: string, fallback: string): string {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TEAM_NAME_MAX_CHARS);
  return cleaned || fallback;
}

/** Clamps a requested team count into the supported 2-4 range. */
export function clampTeamCount(value: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_TEAM_COUNT;
  return Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, parsed));
}

/** Builds `count` fresh teams, in template order. They start empty. */
export function buildTeams(count: number): Team[] {
  const total = clampTeamCount(count);
  return TEAM_TEMPLATES.slice(0, total).map((template, index) => ({
    id: `team_${index + 1}`,
    name: template.name,
    icon: template.icon,
    accentIndex: index,
    score: 0,
    memberIds: [],
  }));
}

export type TeamStartBlocker = 'need-players' | 'need-two-teams' | 'need-nonempty-teams';

export interface TeamStartReadiness {
  /** True when a team-mode round may start. Solo mode is always ready here. */
  ready: boolean;
  /** The first unmet requirement, if any. */
  blocker: TeamStartBlocker | null;
  /** Inline sentence explaining the blocker. */
  message: string | null;
  /** Soft warning when team sizes differ by more than one player. */
  sizeWarning: string | null;
  minSize: number;
  maxSize: number;
}

/**
 * Team-mode start gate: at least two teams must each hold a player, and the
 * selected game's minimum player count must still be met. An unbalanced split
 * is only warned about, never blocked.
 */
export function getTeamStartReadiness(
  playMode: PlayMode,
  teams: Team[],
  playerCount: number,
  minPlayers: number
): TeamStartReadiness {
  const sizes = teams.map((team) => team.memberIds.length);
  const minSize = sizes.length ? Math.min(...sizes) : 0;
  const maxSize = sizes.length ? Math.max(...sizes) : 0;

  const sizeWarning =
    playMode === 'team' && sizes.length > 0 && maxSize - minSize > 1
      ? `Teams are lopsided (${minSize} vs ${maxSize}) — tap Auto-balance for a fairer split.`
      : null;

  const base = { sizeWarning, minSize, maxSize };

  if (playMode !== 'team') {
    return { ...base, ready: playerCount >= minPlayers, blocker: null, message: null };
  }

  if (playerCount < minPlayers) {
    return {
      ...base,
      ready: false,
      blocker: 'need-players',
      message: `Need ${minPlayers - playerCount} more player${
        minPlayers - playerCount === 1 ? '' : 's'
      } to start (min ${minPlayers}).`,
    };
  }

  const populated = sizes.filter((size) => size > 0).length;
  if (populated < MIN_TEAMS) {
    return {
      ...base,
      ready: false,
      blocker: 'need-two-teams',
      message: `At least ${MIN_TEAMS} teams need a player before a team round can start.`,
    };
  }

  if (minSize < 1) {
    return {
      ...base,
      ready: false,
      blocker: 'need-nonempty-teams',
      message: 'Every team needs at least one player — tap a team to join it.',
    };
  }

  return { ...base, ready: true, blocker: null, message: null };
}
