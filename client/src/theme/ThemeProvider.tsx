import React, { createContext, useContext, useState, useEffect } from 'react';
import { DESIGN_TOKENS, PLAYER_COLORS } from '@shared/theme/tokens';

export type ThemeMode = 'light';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
  tokens: typeof DESIGN_TOKENS;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: string;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode] = useState<ThemeMode>('light');
  const isDark = false;

  useEffect(() => {
    const root = document.documentElement;

    // Enforce bright / light mode permanently
    root.setAttribute('data-theme', 'light');
    root.classList.remove('dark');
    try {
      localStorage.setItem('party_game_theme', 'light');
    } catch {
      // ignore
    }

    // Inject / sync standard CSS variables from design system
    root.style.setProperty('--font-display', DESIGN_TOKENS.typography.fontFamily);
    root.style.setProperty('--font-body', DESIGN_TOKENS.typography.fontFamily);
    root.style.setProperty('--radius-card', DESIGN_TOKENS.radii.card);
    root.style.setProperty('--radius-button', DESIGN_TOKENS.radii.button);
    root.style.setProperty('--radius-pill', DESIGN_TOKENS.radii.pill);
    root.style.setProperty('--min-touch-target', DESIGN_TOKENS.spacing.minTouchTarget);

    // Player identity colors
    PLAYER_COLORS.forEach((p, idx) => {
      root.style.setProperty(`--player-${idx + 1}`, p.hex);
    });
  }, []);

  const setMode = () => {};
  const toggleTheme = () => {};

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        toggleTheme,
        isDark,
        tokens: DESIGN_TOKENS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
