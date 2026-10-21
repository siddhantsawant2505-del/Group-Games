/**
 * Mafia deal math, shared by the server engine and the host's settings panel.
 *
 * These functions are pure and depend only on the player count and the public
 * settings, so the client can show the exact role breakdown (and the exact reason
 * Start is disabled) without guessing at the server's rules.
 */

import {
  MAFIA_DETECTIVE_MIN_PLAYERS,
  MAFIA_DOCTOR_MIN_PLAYERS,
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  MAFIA_SETTINGS_LIMITS,
  MafiaRoleBreakdown,
  MafiaSettings,
} from '../types';

/** Auto deal: one Mafia per four players (rounded), at least one. */
export function autoMafiaCount(playerCount: number): number {
  return Math.max(1, Math.round(playerCount / 4));
}

/** The most Mafia that can be dealt without starting the game at parity. */
export function maxMafiaCount(playerCount: number): number {
  return Math.max(1, Math.floor((playerCount - 1) / 2));
}

/** The Mafia count a deal will actually use for this player count. */
export function resolveMafiaCount(playerCount: number, settings: MafiaSettings): number {
  const ceiling = maxMafiaCount(playerCount);
  if (settings.mafiaCount === 'auto') {
    return Math.min(ceiling, autoMafiaCount(playerCount));
  }
  const requested = Math.floor(Number(settings.mafiaCount));
  if (!Number.isFinite(requested)) return Math.min(ceiling, autoMafiaCount(playerCount));
  return Math.min(ceiling, Math.max(1, requested));
}

/**
 * Whether the Detective/Doctor are in this deal. Both need a large enough table,
 * so a host toggle on a small table simply deals no such role (the panel shows
 * the resulting breakdown rather than failing).
 */
export function dealSpecials(
  playerCount: number,
  settings: MafiaSettings
): { detective: boolean; doctor: boolean } {
  return {
    detective: settings.detective && playerCount >= MAFIA_DETECTIVE_MIN_PLAYERS,
    doctor: settings.doctor && playerCount >= MAFIA_DOCTOR_MIN_PLAYERS,
  };
}

export function roleBreakdown(playerCount: number, settings: MafiaSettings): MafiaRoleBreakdown {
  const mafia = resolveMafiaCount(playerCount, settings);
  const specials = dealSpecials(playerCount, settings);
  const specialCount = (specials.detective ? 1 : 0) + (specials.doctor ? 1 : 0);
  return {
    mafia,
    detective: specials.detective,
    doctor: specials.doctor,
    townsperson: Math.max(0, playerCount - mafia - specialCount),
  };
}

export interface SettingsValidation {
  valid: boolean;
  error?: string;
  breakdown: MafiaRoleBreakdown;
}

/**
 * Validates a deal against the table. The server refuses to deal an invalid game;
 * the host UI disables Start and shows `error` for the same input.
 */
export function validateMafiaSettings(
  playerCount: number,
  settings: MafiaSettings
): SettingsValidation {
  const breakdown = roleBreakdown(playerCount, settings);

  if (playerCount < MAFIA_MIN_PLAYERS) {
    return {
      valid: false,
      error: `Mafia needs at least ${MAFIA_MIN_PLAYERS} players.`,
      breakdown,
    };
  }
  if (playerCount > MAFIA_MAX_PLAYERS) {
    return {
      valid: false,
      error: `Mafia supports up to ${MAFIA_MAX_PLAYERS} players.`,
      breakdown,
    };
  }

  const timerError = (
    label: string,
    value: number,
    limits: { min: number; max: number }
  ): string | null => {
    if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
      return `${label} must be between ${limits.min} and ${limits.max} seconds.`;
    }
    return null;
  };

  const error =
    timerError('Night length', settings.nightSeconds, MAFIA_SETTINGS_LIMITS.nightSeconds) ||
    timerError(
      'Discussion length',
      settings.discussionSeconds,
      MAFIA_SETTINGS_LIMITS.discussionSeconds
    ) ||
    timerError('Vote length', settings.voteSeconds, MAFIA_SETTINGS_LIMITS.voteSeconds);
  if (error) return { valid: false, error, breakdown };

  if (settings.mafiaCount !== 'auto') {
    const requested = Math.floor(Number(settings.mafiaCount));
    const ceiling = maxMafiaCount(playerCount);
    if (!Number.isFinite(requested) || requested < 1) {
      return { valid: false, error: 'Mafia count must be at least 1.', breakdown };
    }
    if (requested > ceiling) {
      return {
        valid: false,
        error: `At ${playerCount} players the most Mafia allowed is ${ceiling}.`,
        breakdown,
      };
    }
  }

  if (breakdown.mafia >= playerCount - breakdown.mafia) {
    return {
      valid: false,
      error: 'The Mafia would already start at parity — reduce the Mafia count.',
      breakdown,
    };
  }

  return { valid: true, breakdown };
}
