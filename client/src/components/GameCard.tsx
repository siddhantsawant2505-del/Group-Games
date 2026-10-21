import { motion } from 'motion/react';
import { Users, Check, Settings2, Clock3 } from 'lucide-react';
import { GameMetadata } from '@shared/types';
import { GameIcon } from './GameIcon';
import { TeamSupportBadge } from './TeamSupportBadge';

interface GameCardProps {
  game: GameMetadata;
  selected: boolean;
  onSelect: () => void;
  isHost: boolean;
  /** Opens this game's own settings sheet. */
  onOpenSettings?: () => void;
  /** Short summary of the game's current settings, e.g. "Question · Clean". */
  settingsSummary?: string;
}

export function GameCard({
  game,
  selected,
  onSelect,
  isHost,
  onOpenSettings,
  settingsSummary,
}: GameCardProps) {
  const comingSoon = Boolean(game.comingSoon);

  return (
    <motion.div
      whileHover={comingSoon ? undefined : { y: -2 }}
      whileTap={comingSoon ? undefined : { scale: 0.98 }}
      onClick={() => {
        if (!comingSoon) onSelect();
      }}
      aria-disabled={comingSoon}
      className={`party-card p-4 rounded-2xl transition-all border relative flex flex-col justify-between select-none ${
        comingSoon
          ? 'cursor-not-allowed opacity-70'
          : `cursor-pointer ${
              selected
                ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-neutral-100 border-neutral-800 dark:border-neutral-200 shadow-md'
                : 'hover:border-neutral-400 dark:hover:border-neutral-600'
            }`
      }`}
      style={{
        backgroundColor: selected
          ? 'var(--surface-card-subtle)'
          : 'var(--surface-card)',
      }}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          {/* Icon bubble */}
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 flex items-center justify-center shrink-0">
            <GameIcon icon={game.icon} size={24} />
          </div>

          <div className="flex items-center gap-1.5">
            {comingSoon && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
                <Clock3 className="w-3 h-3" />
                Coming Soon
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              <Users className="w-3 h-3" />
              <span>
                {game.minPlayers}-{game.maxPlayers}
              </span>
            </span>

            {/* Per-game settings live behind this gear, so picking a game and
                tuning it stay two separate taps. Coming Soon games have none. */}
            {onOpenSettings && !comingSoon && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenSettings();
                }}
                title={`${game.title} settings`}
                aria-label={`${game.title} settings`}
                className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            )}

            {selected && (
              <span className="w-6 h-6 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
          </div>
        </div>

        <h3 className="font-extrabold text-lg leading-tight tracking-tight mb-1 text-[var(--text-primary)]">
          {game.title}
        </h3>
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
          {game.tagline}
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 line-clamp-2 leading-relaxed">
          {game.description}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <TeamSupportBadge game={game} />
          {settingsSummary && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
              <Settings2 className="w-3 h-3" />
              <span>{settingsSummary}</span>
            </span>
          )}
        </div>
      </div>

      {selected && (
        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700/60">
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
            How to play:
          </span>
          <ul className="text-xs space-y-1 text-neutral-600 dark:text-neutral-300">
            {game.rules.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-neutral-400">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
