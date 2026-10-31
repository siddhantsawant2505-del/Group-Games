import { motion } from 'motion/react';
import { Lightbulb, Settings2, Target, Timer, Trophy } from 'lucide-react';
import {
  GTL_SETTINGS_LIMITS,
  GtlDifficultySetting,
  GtlSettings,
  Player,
  RoomPublicState,
} from '@shared/types';

type SettingsPatch = { guessTheLink?: Partial<GtlSettings> };
type SaveCallback = (res: { success: boolean; error?: string }) => void;

interface GtlSettingsPanelProps {
  room: RoomPublicState;
  myPlayer: Player;
  onSaveGameSettings?: (patch: SettingsPatch, callback: SaveCallback) => void;
}

const STEPPERS = [
  { key: 'roundCount' as const, label: 'Rounds', unit: '', step: 1 },
  { key: 'roundSeconds' as const, label: 'Guess time', unit: 's', step: 10 },
  { key: 'attempts' as const, label: 'Attempts', unit: '', step: 1 },
];

const DIFFICULTIES: { value: GtlDifficultySetting; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'mixed', label: 'Mixed' },
];

/**
 * Guess the Link settings. Public strategy only: how many rounds, how long the
 * guess window lasts, attempts, difficulty band and whether the hint is shown.
 */
export function GtlSettingsPanel({
  room,
  myPlayer,
  onSaveGameSettings,
}: GtlSettingsPanelProps) {
  const isHost = myPlayer.isHost;
  const settings = room.gameSettings.guessTheLink;

  const emit = (patch: SettingsPatch) => {
    if (!isHost) return;
    onSaveGameSettings?.(patch, () => {});
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
            Guess the Link Settings
          </span>
          <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            {isHost ? 'Applied to the next game' : 'Chosen by the host'}
          </p>
        </div>
      </div>

      {STEPPERS.map((stepper) => {
        const limits = GTL_SETTINGS_LIMITS[stepper.key];
        const value = settings[stepper.key];
        const Icon = stepper.key === 'roundCount' ? Trophy : stepper.key === 'attempts' ? Target : Timer;
        return (
          <div key={stepper.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Icon className="w-3 h-3" />
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
                onClick={() => emit({ guessTheLink: { [stepper.key]: value - stepper.step } })}
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
                onClick={() => emit({ guessTheLink: { [stepper.key]: value + stepper.step } })}
                aria-label={`Increase ${stepper.label}`}
                className="w-10 h-10 rounded-xl border-2 border-[var(--border-subtle)] font-black text-lg text-[var(--text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>

            <p className="text-[10px] font-semibold text-neutral-400 mt-1">
              {limits.min}–{limits.max}
              {stepper.unit}
            </p>
          </div>
        );
      })}

      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
          Difficulty
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {DIFFICULTIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              disabled={!isHost}
              onClick={() => emit({ guessTheLink: { difficulty: value } })}
              className={`px-2 py-2 rounded-xl border-2 text-xs font-black transition-all ${
                isHost ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
              } ${
                settings.difficulty === value
                  ? 'border-amber-500 bg-amber-500/10 text-[var(--text-primary)]'
                  : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <Lightbulb className="w-3 h-3" />
          <span>Hint at half time</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={settings.hintEnabled}
          disabled={!isHost}
          onClick={() => emit({ guessTheLink: { hintEnabled: !settings.hintEnabled } })}
          className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
            settings.hintEnabled ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'
          } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span
            className={`block w-5 h-5 rounded-full bg-white transition-transform ${
              settings.hintEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {!isHost && (
        <p className="text-[10px] font-semibold text-neutral-400">
          The host can change these between games.
        </p>
      )}
    </motion.div>
  );
}
