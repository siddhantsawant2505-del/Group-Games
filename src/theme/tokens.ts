/**
 * Design system tokens and palette constants for Party Games.
 * Mobile-first bright, flat party minigame genre.
 */

export interface PlayerColorToken {
  index: number;
  label: string;
  hex: string;
  contrastText: string; // Black or white for high-contrast readability
}

export const PLAYER_COLORS: readonly PlayerColorToken[] = [
  { index: 0, label: 'Coral Red', hex: '#FF5A5F', contrastText: '#FFFFFF' },
  { index: 1, label: 'Sky Blue', hex: '#3AA0FF', contrastText: '#FFFFFF' },
  { index: 2, label: 'Sunny Yellow', hex: '#FFC93C', contrastText: '#1A1B1E' },
  { index: 3, label: 'Grass Green', hex: '#4CD787', contrastText: '#1A1B1E' },
  { index: 4, label: 'Violet', hex: '#9B6DFF', contrastText: '#FFFFFF' },
  { index: 5, label: 'Hot Pink', hex: '#FF6FB0', contrastText: '#FFFFFF' },
] as const;

export const THEME_COLORS = {
  light: {
    background: '#FAFAF7',
    surface: '#FFFFFF',
    textPrimary: '#1A1B1E',
    textSecondary: '#6B6D73',
    border: 'rgba(26, 27, 30, 0.08)',
  },
  dark: {
    background: '#16171A',
    surface: '#212226',
    textPrimary: '#F2F2F0',
    textSecondary: '#A0A2A8',
    border: 'rgba(242, 242, 240, 0.1)',
  },
  semantic: {
    success: '#22C55E',
    danger: '#EF4444',
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

export const THEME_TYPOGRAPHY = {
  fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headingWeight: '600',
  titleWeight: '800',
  bodyWeight: '500',
  timerWeight: '900',
  timerSize: '48px',
  roundTitleSize: '28px',
  bodySize: '16px',
} as const;

export const DESIGN_TOKENS = {
  colors: THEME_COLORS,
  playerColors: PLAYER_COLORS,
  spacing: THEME_SPACING,
  radii: THEME_RADII,
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
 * Returns accessible text color for a given player hex
 */
export function getPlayerTextColor(colorIndex: number): string {
  return getPlayerColor(colorIndex).contrastText;
}
