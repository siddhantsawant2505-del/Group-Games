import { motion } from 'motion/react';
import { Users, Check, Settings2, Clock3 } from 'lucide-react';
import { GameMetadata } from '@shared/types';
import { getGameThemeColor } from '@shared/theme/tokens';
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
  const themeColor = getGameThemeColor(game.id);

  return (
    <motion.div
      whileHover={comingSoon ? undefined : { y: -2, x: -1 }}
      whileTap={comingSoon ? undefined : { x: 2, y: 2 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      onClick={() => {
        if (!comingSoon) onSelect();
      }}
      aria-disabled={comingSoon}
      className={`p-4 rounded-2xl transition-all border-[2.5px] border-[var(--border-neo)] relative flex flex-col justify-between select-none ${
        comingSoon
          ? 'cursor-not-allowed opacity-70 bg-[var(--surface-card)]'
          : `cursor-pointer ${
              selected
                ? 'shadow-[6px_6px_0px_var(--border-neo)] -translate-y-1'
                : 'shadow-[4px_4px_0px_var(--border-neo)] bg-[var(--surface-card)] active:shadow-[1px_1px_0px_var(--border-neo)]'
            }`
      }`}
      style={{
        backgroundColor: selected
          ? themeColor.bg
          : 'var(--surface-card)',
      }}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          {/* Icon bubble */}
          <div className="w-12 h-12 rounded-xl bg-white border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-[var(--text-primary)] flex items-center justify-center shrink-0">
            <GameIcon icon={game.icon} size={24} />
          </div>

          <div className="flex items-center gap-1.5">
            {comingSoon && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-[#FDA4AF] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)]">
                <Clock3 className="w-3 h-3" />
                Coming Soon
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-white border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] text-[var(--text-primary)]">
              <Users className="w-3 h-3" />
              <span>
                {game.minPlayers}-{game.maxPlayers}
              </span>
            </span>

            {onOpenSettings && !comingSoon && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenSettings();
                }}
                title={`${game.title} settings`}
                aria-label={`${game.title} settings`}
                className="w-7 h-7 rounded-lg bg-white border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] text-[var(--text-primary)] flex items-center justify-center cursor-pointer tactile-btn"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            )}

            {selected && (
              <span className="w-7 h-7 rounded-lg bg-white text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] flex items-center justify-center font-black">
                <Check className="w-4 h-4 stroke-[3]" />
              </span>
            )}
          </div>
        </div>

        <h3 className="font-black text-lg leading-tight tracking-tight mb-1 text-[var(--text-primary)]">
          {game.title}
        </h3>
        <p className="text-xs font-bold opacity-75 mb-2 text-[var(--text-primary)]">
          {game.tagline}
        </p>
        <p className="text-sm font-medium opacity-90 line-clamp-2 leading-relaxed text-[var(--text-primary)]">
          {game.description}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <TeamSupportBadge game={game} />
          {settingsSummary && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#93C5FD] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)]">
              <Settings2 className="w-3 h-3" />
              <span>{settingsSummary}</span>
            </span>
          )}
        </div>
      </div>

      {selected && (
        <div className="mt-3 pt-3 border-t-2 border-[var(--border-neo)]">
          <span className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider block mb-1">
            How to play:
          </span>
          <ul className="text-xs space-y-1 font-semibold text-[var(--text-primary)]">
            {game.rules.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-[#18181B]">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
