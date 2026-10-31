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
      className="bg-white border-[2.5px] border-[var(--border-neo)] shadow-[5px_5px_0px_var(--border-neo)] p-5 rounded-3xl space-y-4"
    >
      <div className="flex items-center gap-2.5 pb-2 border-b-2 border-[#18181B]/10">
        <div className="w-10 h-10 rounded-2xl bg-[#FEF08A] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-center shrink-0 font-black">
          <Settings2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <span className="text-base font-black text-[var(--text-primary)] block leading-tight">
            Top 100 Settings
          </span>
          <p className="text-xs font-bold text-[#52525B]">
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
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                {stepper.key === 'roundCount' ? (
                  <Trophy className="w-3.5 h-3.5 text-[#18181B]" />
                ) : (
                  <Timer className="w-3.5 h-3.5 text-[#18181B]" />
                )}
                <span>{stepper.label}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF8F5] border border-[var(--border-neo)] text-xs font-black text-[var(--text-primary)] font-mono">
                {value}
                {stepper.unit}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={!isHost || value <= limits.min}
                onClick={() =>
                  emit({
                    top100: { [stepper.key]: Math.max(limits.min, value - step) },
                  })
                }
                aria-label={`Decrease ${stepper.label}`}
                className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
              >
                −
              </button>

              <div className="flex-1 h-3 rounded-full bg-[#F3EFEA] border-2 border-[var(--border-neo)] overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-[#FEF08A] border border-[var(--border-neo)] transition-all"
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
                className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
              >
                +
              </button>
            </div>

            <p className="text-[11px] font-bold text-[#52525B] mt-1">
              {stepper.help} ({limits.min}–{limits.max}
              {stepper.unit})
            </p>
          </div>
        );
      })}

      {isTeamMode && settings.guessSeconds < TOP100_TEAM_MIN_GUESS_SECONDS && (
        <div className="p-3 rounded-2xl bg-[#FEF08A] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black text-[#18181B]">
          Team mode gives captains at least {TOP100_TEAM_MIN_GUESS_SECONDS}s so they can read their
          team&apos;s suggestions.
        </div>
      )}

      {/* Duplicates */}
      <div className="pt-2 border-t-2 border-[#18181B]/10">
        <span className="text-xs font-black uppercase tracking-wider text-[#18181B] block mb-1.5">
          Duplicate Guesses
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          {(['allow', 'zero'] as const).map((policy) => {
            const active = settings.duplicatePolicy === policy;
            return (
              <button
                key={policy}
                type="button"
                disabled={!isHost}
                onClick={() => emit({ top100: { duplicatePolicy: policy } })}
                className={`px-3 py-2.5 rounded-2xl text-xs font-black transition-all ${
                  isHost ? 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]' : 'cursor-default'
                } ${
                  active
                    ? 'border-[2.5px] border-[var(--border-neo)] bg-[#93C5FD] text-[#18181B] shadow-[2.5px_2.5px_0px_var(--border-neo)] -translate-x-0.5 -translate-y-0.5'
                    : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B] hover:border-[var(--border-neo)] hover:bg-white'
                }`}
              >
                {TOP100_DUPLICATE_POLICY_LABELS[policy]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Region */}
      <div className="pt-2 border-t-2 border-[#18181B]/10">
        <span className="text-xs font-black uppercase tracking-wider text-[#18181B] flex items-center gap-1.5 mb-1.5">
          <Globe2 className="w-4 h-4 text-[#18181B]" />
          <span>Lists Scope</span>
        </span>
        <div className="grid grid-cols-3 gap-2">
          {(['mixed', 'global', 'india'] as const).map((region) => {
            const active = settings.region === region;
            return (
              <button
                key={region}
                type="button"
                disabled={!isHost}
                onClick={() => emit({ top100: { region } })}
                className={`px-2 py-2.5 rounded-2xl text-xs font-black transition-all ${
                  isHost ? 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]' : 'cursor-default'
                } ${
                  active
                    ? 'border-[2.5px] border-[var(--border-neo)] bg-[#86EFAC] text-[#18181B] shadow-[2.5px_2.5px_0px_var(--border-neo)] -translate-x-0.5 -translate-y-0.5'
                    : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B] hover:border-[var(--border-neo)] hover:bg-white'
                }`}
              >
                {TOP100_REGION_LABELS[region]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Categories */}
      <div className="pt-2 border-t-2 border-[#18181B]/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
            <ListOrdered className="w-4 h-4 text-[#18181B]" />
            <span>Categories</span>
          </span>
          {settings.categories.length > 0 && isHost && (
            <button
              type="button"
              onClick={() => emit({ top100: { categories: [] } })}
              className="text-xs font-black text-[#18181B] bg-[#FEF08A] px-2 py-0.5 rounded-lg border border-[var(--border-neo)] cursor-pointer"
            >
              Reset to all
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {TOP100_CATEGORY_OPTIONS.map((option) => {
            const active = settings.categories.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={!isHost}
                onClick={() => toggleCategory(option.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  isHost ? 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]' : 'cursor-default'
                } ${
                  active
                    ? 'border-2 border-[var(--border-neo)] bg-[#86EFAC] text-[#18181B] shadow-[2px_2px_0px_var(--border-neo)]'
                    : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B] hover:border-[var(--border-neo)]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] font-bold text-[#52525B] mt-2">
          {settings.categories.length === 0
            ? 'Every category is in play; a round never repeats the previous category.'
            : `${settings.categories.length} category filter${
                settings.categories.length === 1 ? '' : 's'
              } active.`}
        </p>
      </div>

      {!isHost && (
        <p className="text-[11px] font-bold text-[#52525B]">
          The host can change these between games.
        </p>
      )}
    </motion.div>
  );
}
