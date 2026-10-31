import { motion } from 'motion/react';
import { Settings2, Timer, Trophy } from 'lucide-react';
import {
  AVOID_SETTINGS_LIMITS,
  AvoidSettings,
  Player,
  RoomPublicState,
  TONE_LABELS,
} from '@shared/types';

type SettingsPatch = { avoidTheWord?: Partial<AvoidSettings> };
type SaveCallback = (res: { success: boolean; error?: string }) => void;

interface AvoidSettingsPanelProps {
  room: RoomPublicState;
  myPlayer: Player;
  onSaveGameSettings?: (patch: SettingsPatch, callback: SaveCallback) => void;
}

const STEPPERS = [
  {
    key: 'anchorSeconds' as const,
    label: 'Anchor answer time',
    unit: 's',
    help: 'How long the anchor gets to pick their answer.',
  },
  {
    key: 'turnSeconds' as const,
    label: 'Turn time',
    unit: 's',
    help: 'Each other player gets this long on their turn.',
  },
  {
    key: 'roundCap' as const,
    label: 'Round cap',
    unit: ' rounds',
    help: 'The game ends here if more than one player is still alive.',
  },
];

export function AvoidSettingsPanel({
  room,
  myPlayer,
  onSaveGameSettings,
}: AvoidSettingsPanelProps) {
  const isHost = myPlayer.isHost;
  const settings = room.gameSettings.avoidTheWord;

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
        <div className="w-10 h-10 rounded-2xl bg-[#FDBA74] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-center shrink-0 font-black">
          <Settings2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <span className="text-base font-black text-[var(--text-primary)] block leading-tight">
            Avoid the Word Settings
          </span>
          <p className="text-xs font-bold text-[#52525B]">
            {isHost ? 'Applied to the next game' : 'Chosen by the host'}
          </p>
        </div>
      </div>

      {STEPPERS.map((stepper) => {
        const limits = AVOID_SETTINGS_LIMITS[stepper.key];
        const value = settings[stepper.key];
        return (
          <div key={stepper.key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                {stepper.key === 'roundCap' ? (
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
                onClick={() => emit({ avoidTheWord: { [stepper.key]: value - 1 } })}
                aria-label={`Decrease ${stepper.label}`}
                className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
              >
                −
              </button>

              <div className="flex-1 h-3 rounded-full bg-[#F3EFEA] border-2 border-[var(--border-neo)] overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-[#FDBA74] border border-[var(--border-neo)] transition-all"
                  style={{
                    width: `${((value - limits.min) / (limits.max - limits.min)) * 100}%`,
                  }}
                />
              </div>

              <button
                type="button"
                disabled={!isHost || value >= limits.max}
                onClick={() => emit({ avoidTheWord: { [stepper.key]: value + 1 } })}
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

      {/* Tone */}
      <div className="pt-2 border-t-2 border-[#18181B]/10">
        <span className="text-xs font-black uppercase tracking-wider text-[#18181B] block mb-1.5">
          Question Tone
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          {(['clean', 'spicy'] as const).map((tone) => {
            const active = settings.tone === tone;
            const activeBg = tone === 'clean' ? 'bg-[#86EFAC]' : 'bg-[#FDA4AF]';
            return (
              <button
                key={tone}
                type="button"
                disabled={!isHost}
                onClick={() => emit({ avoidTheWord: { tone } })}
                className={`px-3 py-2.5 rounded-2xl text-xs font-black transition-all ${
                  isHost ? 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]' : 'cursor-default'
                } ${
                  active
                    ? `border-[2.5px] border-[var(--border-neo)] ${activeBg} text-[#18181B] shadow-[2.5px_2.5px_0px_var(--border-neo)] -translate-x-0.5 -translate-y-0.5`
                    : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B] hover:border-[var(--border-neo)] hover:bg-white'
                }`}
              >
                {TONE_LABELS[tone]}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] font-bold text-[#52525B] mt-1.5">
          Spicy stays mild — cheekier questions, never rude ones.
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
