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

const DIFFICULTIES: { value: GtlDifficultySetting; label: string; bg: string }[] = [
  { value: 'easy', label: 'Easy', bg: 'bg-[#86EFAC]' },
  { value: 'medium', label: 'Medium', bg: 'bg-[#93C5FD]' },
  { value: 'hard', label: 'Hard', bg: 'bg-[#FDA4AF]' },
  { value: 'mixed', label: 'Mixed', bg: 'bg-[#FEF08A]' },
];

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
      className="bg-white border-[2.5px] border-[var(--border-neo)] shadow-[5px_5px_0px_var(--border-neo)] p-5 rounded-3xl space-y-4"
    >
      <div className="flex items-center gap-2.5 pb-2 border-b-2 border-[#18181B]/10">
        <div className="w-10 h-10 rounded-2xl bg-[#93C5FD] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-center shrink-0 font-black">
          <Settings2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <span className="text-base font-black text-[var(--text-primary)] block leading-tight">
            Guess the Link Settings
          </span>
          <p className="text-xs font-bold text-[#52525B]">
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
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-[#18181B]" />
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
                onClick={() => emit({ guessTheLink: { [stepper.key]: value - stepper.step } })}
                aria-label={`Decrease ${stepper.label}`}
                className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
              >
                −
              </button>

              <div className="flex-1 h-3 rounded-full bg-[#F3EFEA] border-2 border-[var(--border-neo)] overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-[#93C5FD] border border-[var(--border-neo)] transition-all"
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
                className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
              >
                +
              </button>
            </div>

            <p className="text-[11px] font-bold text-[#52525B] mt-1">
              {limits.min}–{limits.max}
              {stepper.unit}
            </p>
          </div>
        );
      })}

      <div className="pt-2 border-t-2 border-[#18181B]/10">
        <span className="text-xs font-black uppercase tracking-wider text-[#18181B] block mb-1.5">
          Difficulty Band
        </span>
        <div className="grid grid-cols-4 gap-2">
          {DIFFICULTIES.map(({ value, label, bg }) => {
            const active = settings.difficulty === value;
            return (
              <button
                key={value}
                type="button"
                disabled={!isHost}
                onClick={() => emit({ guessTheLink: { difficulty: value } })}
                className={`px-2 py-2.5 rounded-2xl text-xs font-black transition-all ${
                  isHost ? 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]' : 'cursor-default'
                } ${
                  active
                    ? `border-[2.5px] border-[var(--border-neo)] ${bg} text-[#18181B] shadow-[2.5px_2.5px_0px_var(--border-neo)] -translate-x-0.5 -translate-y-0.5`
                    : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B] hover:border-[var(--border-neo)] hover:bg-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2 border-t-2 border-[#18181B]/10 flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-[#18181B]" />
          <span>Hint at Half Time</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={settings.hintEnabled}
          disabled={!isHost}
          onClick={() => emit({ guessTheLink: { hintEnabled: !settings.hintEnabled } })}
          className={`w-13 h-7 rounded-full p-0.5 transition-colors border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] ${
            settings.hintEnabled ? 'bg-[#86EFAC]' : 'bg-[#E4E4E7]'
          } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span
            className={`block w-5 h-5 rounded-full bg-white border border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] transition-transform ${
              settings.hintEnabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {!isHost && (
        <p className="text-[11px] font-bold text-[#52525B]">
          The host can change these between games.
        </p>
      )}
    </motion.div>
  );
}
