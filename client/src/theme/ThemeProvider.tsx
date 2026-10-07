import React, { createContext, useContext, useState, useEffect } from 'react';
import { DESIGN_TOKENS, PLAYER_COLORS } from '@shared/theme/tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

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
  defaultMode?: ThemeMode;
}

export function ThemeProvider({ children, defaultMode = 'system' }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('party_game_theme');
      return (saved as ThemeMode) || defaultMode;
    } catch {
      return defaultMode;
    }
  });

  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      const activeDark =
        mode === 'dark' || (mode === 'system' && mediaQuery.matches);
      setIsDark(activeDark);

      if (mode === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', mode);
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
    };

    updateTheme();

    const listener = () => {
      if (mode === 'system') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [mode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem('party_game_theme', newMode);
    } catch {
      // ignore
    }
  };

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

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
