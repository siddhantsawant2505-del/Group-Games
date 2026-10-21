import { MafiaRole } from '@shared/types';

export type MafiaRoleIcon = 'skull' | 'search' | 'heart' | 'users';

export interface MafiaRoleStyle {
  accent: string;
  /** Dark card background for the secret roles; town keeps the light surface. */
  background: string;
  onDark: boolean;
  icon: MafiaRoleIcon;
  label: string;
  tagline: string;
}

/**
 * One distinct look per role, built from the design tokens rather than new
 * one-off styles. The Townsperson card stays on the normal surface; the three
 * secret roles get a dark card so a glance from across the table reads as
 * "something private is on that screen".
 */
export const MAFIA_ROLE_STYLES: Record<MafiaRole, MafiaRoleStyle> = {
  mafia: {
    accent: '#EF4444',
    background: '#2B1113',
    onDark: true,
    icon: 'skull',
    label: 'The Mafia',
    tagline: 'Kill by night. Blend in by day.',
  },
  detective: {
    accent: '#6366F1',
    background: '#1B1A3A',
    onDark: true,
    icon: 'search',
    label: 'The Detective',
    tagline: 'Investigate one player every night.',
  },
  doctor: {
    accent: '#14B8A6',
    background: '#0E2A28',
    onDark: true,
    icon: 'heart',
    label: 'The Doctor',
    tagline: 'Keep someone alive — maybe even yourself.',
  },
  townsperson: {
    accent: '#22C55E',
    background: 'var(--surface-card)',
    onDark: false,
    icon: 'users',
    label: 'Townsperson',
    tagline: 'No night action. Hunt the Mafia by day.',
  },
};
