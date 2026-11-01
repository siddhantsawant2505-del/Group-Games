/**
 * Design system tokens and palette constants for Party Games.
 * Soothing Neo-Brutalism ("Chubby Neo-Brutalism") palette and tokens.
 */

export interface PlayerColorToken {
  index: number;
  label: string;
  hex: string;
  contrastText: string; // Black/charcoal for high-contrast readability on pastel pop
}

export const PLAYER_COLORS: readonly PlayerColorToken[] = [
  { index: 0, label: 'Bubblegum Coral', hex: '#FDA4AF', contrastText: '#18181B' },
  { index: 1, label: 'Sky Blue', hex: '#93C5FD', contrastText: '#18181B' },
  { index: 2, label: 'Butter Yellow', hex: '#FEF08A', contrastText: '#18181B' },
  { index: 3, label: 'Pistachio Mint', hex: '#86EFAC', contrastText: '#18181B' },
  { index: 4, label: 'Lavender Grape', hex: '#C4B5FD', contrastText: '#18181B' },
  { index: 5, label: 'Tangerine Sorbet', hex: '#FDBA74', contrastText: '#18181B' },
] as const;

/**
 * Team accents. Deeper solid shades paired with clear iconography.
 */
export interface TeamAccentToken {
  index: number;
  label: string;
  hex: string;
  contrastText: string;
}

export const TEAM_ACCENTS: readonly TeamAccentToken[] = [
  { index: 0, label: 'Deep Teal', hex: '#0B7285', contrastText: '#FFFFFF' },
  { index: 1, label: 'Burnt Orange', hex: '#E8590C', contrastText: '#FFFFFF' },
  { index: 2, label: 'Forest Green', hex: '#087F5B', contrastText: '#FFFFFF' },
  { index: 3, label: 'Deep Indigo', hex: '#5F3DC4', contrastText: '#FFFFFF' },
] as const;

/** Get team accent info by slot (0 to 3, loops if more teams exist). */
export function getTeamAccent(accentIndex: number): TeamAccentToken {
  const normalized = Math.abs(accentIndex) % TEAM_ACCENTS.length;
  return TEAM_ACCENTS[normalized];
}

export const THEME_COLORS = {
  light: {
    background: '#FAF8F5',
    surface: '#FFFFFF',
    textPrimary: '#18181B',
    textSecondary: '#52525B',
    border: '#18181B',
  },
  dark: {
    background: '#18181B',
    surface: '#27272A',
    textPrimary: '#FAF8F5',
    textSecondary: '#A1A1AA',
    border: '#3F3F46',
  },
  semantic: {
    success: '#86EFAC',
    danger: '#FDA4AF',
    warning: '#FDBA74',
    info: '#93C5FD',
    specialRoleAccent: '#3D2C4E', // deep charcoal-purple for impostor/secret reveals
    specialRoleAccentLight: '#4D3864',
  },
} as const;

export const THEME_SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  minTouchTarget: '48px',
} as const;

export const THEME_RADII = {
  card: '20px',
  button: '18px',
  pill: '9999px',
  inner: '14px',
} as const;

export const THEME_SHADOWS = {
  sm: '2px 2px 0px #18181B',
  md: '4px 4px 0px #18181B',
  lg: '6px 6px 0px #18181B',
  active: '1px 1px 0px #18181B',
} as const;

export const THEME_TYPOGRAPHY = {
  fontFamily: "'Plus Jakarta Sans', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  monoFamily: "'JetBrains Mono', 'Fira Code', monospace",
  headingWeight: '700',
  titleWeight: '800',
  bodyWeight: '500',
  timerWeight: '800',
  timerSize: '40px',
  roundTitleSize: '28px',
  bodySize: '16px',
} as const;

export const DESIGN_TOKENS = {
  colors: THEME_COLORS,
  playerColors: PLAYER_COLORS,
  teamAccents: TEAM_ACCENTS,
  spacing: THEME_SPACING,
  radii: THEME_RADII,
  shadows: THEME_SHADOWS,
  typography: THEME_TYPOGRAPHY,
} as const;

/**
 * Get player color info based on join order index (0 to 5, loops if > 5)
 */
export function getPlayerColor(colorIndex: number): PlayerColorToken {
  const normalized = Math.abs(colorIndex) % PLAYER_COLORS.length;
  return PLAYER_COLORS[normalized];
}

/**
 * Distinct signature pastel color mapping for each game mode.
 */
export interface GameThemeColor {
  bg: string;
  border: string;
  text: string;
  name: string;
}

export const GAME_THEME_COLORS: Record<string, GameThemeColor> = {
  'impostor': {
    bg: '#FDA4AF', // Rose Pop / Bubblegum Coral
    border: '#18181B',
    text: '#18181B',
    name: 'Rose Pop',
  },
  'avoid-the-word': {
    bg: '#FDBA74', // Creamsicle Orange
    border: '#18181B',
    text: '#18181B',
    name: 'Creamsicle Orange',
  },
  'mafia': {
    bg: '#C4B5FD', // Lavender Grape
    border: '#18181B',
    text: '#18181B',
    name: 'Lavender Grape',
  },
  'guess-the-link': {
    bg: '#93C5FD', // Sky Pastel
    border: '#18181B',
    text: '#18181B',
    name: 'Sky Pastel',
  },
  'top-100': {
    bg: '#FEF08A', // Butter Yellow
    border: '#18181B',
    text: '#18181B',
    name: 'Butter Yellow',
  },
  'reverse-categories': {
    bg: '#86EFAC', // Pistachio Mint
    border: '#18181B',
    text: '#18181B',
    name: 'Pistachio Mint',
  },
};

export function getGameThemeColor(gameId?: string): GameThemeColor {
  if (gameId && GAME_THEME_COLORS[gameId]) {
    return GAME_THEME_COLORS[gameId];
  }
  return {
    bg: '#FEF08A',
    border: '#18181B',
    text: '#18181B',
    name: 'Butter Yellow',
  };
}

/**
 * Returns accessible text color for a given player hex
 */
export function getPlayerTextColor(colorIndex: number): string {
  return getPlayerColor(colorIndex).contrastText;
}
