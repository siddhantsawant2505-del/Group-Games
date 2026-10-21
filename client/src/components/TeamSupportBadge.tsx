import { Users2, Combine, Swords } from 'lucide-react';
import { GameMetadata } from '@shared/types';

interface TeamSupportBadgeProps {
  game: GameMetadata;
  /** Renders a slightly larger badge with the full sentence. */
  size?: 'sm' | 'md';
}

/**
 * Tells the host how a game behaves in room team mode: its points roll up to
 * teams (`aggregate`), it plays its own team rules today (`shipped`, e.g. Top
 * 100's one guess per team), or those rules are still planned (`native`).
 */
export function TeamSupportBadge({ game, size = 'sm' }: TeamSupportBadgeProps) {
  const shipped = game.teamSupport === 'shipped';
  const aggregate = game.teamSupport === 'aggregate';
  const label = shipped ? 'Teams: own rules' : aggregate ? 'Teams: scores combine' : 'Team-ready';
  const Icon = shipped ? Swords : aggregate ? Combine : Users2;
  const title = shipped
    ? 'Native team rules: one guess per team, rotating captains, team-only scores'
    : aggregate
    ? 'Plays exactly as in solo — every point also counts for your team'
    : 'Plays as in solo for now; native team rules are planned';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
      title={title}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{label}</span>
    </span>
  );
}
