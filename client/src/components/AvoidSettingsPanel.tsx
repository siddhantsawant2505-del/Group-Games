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

/** Each stepper keeps its own copy short: label, unit and explanation. */
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

/**
 * Avoid the Word settings. All four values are public strategy — the server
 * clamps them to the same bounds, and they only affect how a round plays.
 */
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
      className="party-card p-4 rounded-2xl space-y-3"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
          <Settings2 className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-black text-[var(--text-primary)] block leading-tight">
            Avoid the Word Settings
          </span>
          <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            {isHost ? 'Applied to the next game' : 'Chosen by the host'}
          </p>
        </div>
      </div>

      {STEPPERS.map((stepper) => {
        const limits = AVOID_SETTINGS_LIMITS[stepper.key];
        const value = settings[stepper.key];
        return (
          <div key={stepper.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                {stepper.key === 'roundCap' ? (
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
                onClick={() => emit({ avoidTheWord: { [stepper.key]: value - 1 } })}
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
                onClick={() => emit({ avoidTheWord: { [stepper.key]: value + 1 } })}
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

      {/* Tone: clean by default, mild spicy questions only when opted into */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
          Question tone
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(['clean', 'spicy'] as const).map((tone) => {
            const active = settings.tone === tone;
            return (
              <button
                key={tone}
                type="button"
                disabled={!isHost}
                onClick={() => emit({ avoidTheWord: { tone } })}
                className={`px-3 py-2 rounded-xl border-2 text-xs font-black transition-all ${
                  isHost ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                } ${
                  active
                    ? 'border-amber-500 bg-amber-500/10 text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {TONE_LABELS[tone]}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-semibold text-neutral-400 mt-1">
          Spicy stays mild — cheekier questions, never rude ones.
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
