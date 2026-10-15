import { motion } from 'motion/react';
import { Globe2, ListOrdered, Settings2, Timer, Trophy } from 'lucide-react';
import {
  Player,
  RoomPublicState,
  TOP100_DUPLICATE_POLICY_LABELS,
  TOP100_REGION_LABELS,
  TOP100_SETTINGS_LIMITS,
  TOP100_TEAM_MIN_GUESS_SECONDS,
  Top100Settings,
} from '@shared/types';
import { TOP100_CATEGORY_OPTIONS } from '@shared/data/top100Categories';

type SettingsPatch = { top100?: Partial<Top100Settings> };
type SaveCallback = (res: { success: boolean; error?: string }) => void;

interface Top100SettingsPanelProps {
  room: RoomPublicState;
  myPlayer: Player;
  onSaveGameSettings?: (patch: SettingsPatch, callback: SaveCallback) => void;
}

const STEPPERS = [
  {
    key: 'roundCount' as const,
    label: 'Rounds',
    unit: '',
    help: 'How many questions one game runs.',
  },
  {
    key: 'guessSeconds' as const,
    label: 'Guess time',
    unit: 's',
    help: 'How long players (or captains) get to lock a guess.',
  },
];

/**
 * Top 100 settings. Everything here is public strategy: how many rounds, how
 * long the guess window is, how duplicates score, and which lists a room may
 * draw. The lists themselves never reach the client.
 */
export function Top100SettingsPanel({
  room,
  myPlayer,
  onSaveGameSettings,
}: Top100SettingsPanelProps) {
  const isHost = myPlayer.isHost;
  const settings = room.gameSettings.top100;
  const isTeamMode = room.playMode === 'team';

  const emit = (patch: SettingsPatch) => {
    if (!isHost) return;
    onSaveGameSettings?.(patch, () => {});
  };

  const toggleCategory = (categoryId: string) => {
    if (!isHost) return;
    const active = settings.categories.includes(categoryId);
    const next = active
      ? settings.categories.filter((id) => id !== categoryId)
      : [...settings.categories, categoryId];
    emit({ top100: { categories: next } });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="party-card p-4 rounded-2xl space-y-3"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
          <Settings2 className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-black text-[var(--text-primary)] block leading-tight">
            Top 100 Settings
          </span>
          <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            {isHost ? 'Applied to the next game' : 'Chosen by the host'}
          </p>
        </div>
      </div>

      {STEPPERS.map((stepper) => {
        const limits = TOP100_SETTINGS_LIMITS[stepper.key];
        const value = settings[stepper.key];
        const step = 5;
        return (
          <div key={stepper.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                {stepper.key === 'roundCount' ? (
                  <Trophy className="w-3 h-3" />
                ) : (
                  <Timer className="w-3 h-3" />
                )}
                <span>{stepper.label}</span>
              </span>
              <span className="text-xs font-black text-[var(--text-primary)]">
                {value}
                {stepper.unit}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!isHost || value <= limits.min}
                onClick={() =>
                  emit({
                    top100: { [stepper.key]: Math.max(limits.min, value - step) },
                  })
                }
                aria-label={`Decrease ${stepper.label}`}
                className="w-10 h-10 rounded-xl border-2 border-[var(--border-subtle)] font-black text-lg text-[var(--text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                −
              </button>

              <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{
                    width: `${((value - limits.min) / (limits.max - limits.min)) * 100}%`,
                  }}
                />
              </div>

              <button
                type="button"
                disabled={!isHost || value >= limits.max}
                onClick={() =>
                  emit({
                    top100: { [stepper.key]: Math.min(limits.max, value + step) },
                  })
                }
                aria-label={`Increase ${stepper.label}`}
                className="w-10 h-10 rounded-xl border-2 border-[var(--border-subtle)] font-black text-lg text-[var(--text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>

            <p className="text-[10px] font-semibold text-neutral-400 mt-1">
              {stepper.help} ({limits.min}–{limits.max}
              {stepper.unit})
            </p>
          </div>
        );
      })}

      {isTeamMode && settings.guessSeconds < TOP100_TEAM_MIN_GUESS_SECONDS && (
        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          Team mode gives captains at least {TOP100_TEAM_MIN_GUESS_SECONDS}s so they can read their
          team&apos;s suggestions.
        </p>
      )}

      {/* Duplicates */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
          Duplicate guesses
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(['allow', 'zero'] as const).map((policy) => {
            const active = settings.duplicatePolicy === policy;
            return (
              <button
                key={policy}
                type="button"
                disabled={!isHost}
                onClick={() => emit({ top100: { duplicatePolicy: policy } })}
                className={`px-2 py-2 rounded-xl border-2 text-[11px] font-black transition-all ${
                  isHost ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                } ${
                  active
                    ? 'border-amber-500 bg-amber-500/10 text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {TOP100_DUPLICATE_POLICY_LABELS[policy]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Region */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-1">
          <Globe2 className="w-3 h-3" />
          <span>Lists</span>
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {(['mixed', 'global', 'india'] as const).map((region) => {
            const active = settings.region === region;
            return (
              <button
                key={region}
                type="button"
                disabled={!isHost}
                onClick={() => emit({ top100: { region } })}
                className={`px-2 py-2 rounded-xl border-2 text-[11px] font-black transition-all ${
                  isHost ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                } ${
                  active
                    ? 'border-amber-500 bg-amber-500/10 text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {TOP100_REGION_LABELS[region]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Categories: none selected means every category is eligible */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <ListOrdered className="w-3 h-3" />
            <span>Categories</span>
          </span>
          {settings.categories.length > 0 && isHost && (
            <button
              type="button"
              onClick={() => emit({ top100: { categories: [] } })}
              className="text-[10px] font-black text-amber-600 dark:text-amber-400 cursor-pointer underline"
            >
              All categories
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TOP100_CATEGORY_OPTIONS.map((option) => {
            const active = settings.categories.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={!isHost}
                onClick={() => toggleCategory(option.id)}
                className={`px-2.5 py-1.5 rounded-xl border-2 text-[11px] font-black transition-all ${
                  isHost ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                } ${
                  active
                    ? 'border-amber-500 bg-amber-500/10 text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-semibold text-neutral-400 mt-1">
          {settings.categories.length === 0
            ? 'Every category is in play; a round never repeats the previous category.'
            : `${settings.categories.length} category filter${
                settings.categories.length === 1 ? '' : 's'
              } active.`}
        </p>
      </div>

      {!isHost && (
        <p className="text-[10px] font-semibold text-neutral-400">
          The host can change these between games.
        </p>
      )}
    </motion.div>
  );
}
