import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Eye, HeartPulse, Search, Settings2, Skull, Timer, Users } from 'lucide-react';
import {
  MAFIA_SETTINGS_LIMITS,
  MafiaSettings,
  Player,
  RoomPublicState,
} from '@shared/types';
import { validateMafiaSettings } from '@shared/data/mafiaSetup';

type SettingsPatch = { mafia?: Partial<MafiaSettings> };
type SaveCallback = (res: { success: boolean; error?: string }) => void;

interface MafiaSettingsPanelProps {
  room: RoomPublicState;
  myPlayer: Player;
  onSaveGameSettings?: (patch: SettingsPatch, callback: SaveCallback) => void;
}

const TIMERS = [
  {
    key: 'nightSeconds' as const,
    label: 'Night',
    step: 5,
    limits: MAFIA_SETTINGS_LIMITS.nightSeconds,
    help: 'Mafia, Doctor and Detective act in private.',
  },
  {
    key: 'discussionSeconds' as const,
    label: 'Discussion',
    step: 15,
    limits: MAFIA_SETTINGS_LIMITS.discussionSeconds,
    help: 'The village argues before the ballot.',
  },
  {
    key: 'voteSeconds' as const,
    label: 'Vote',
    step: 5,
    limits: MAFIA_SETTINGS_LIMITS.voteSeconds,
    help: 'Secret ballots close after this.',
  },
];

/**
 * Mafia settings: public strategy only. The panel shows the exact deal the
 * server will make, and the same validity check the server enforces, so the
 * host sees why Start is blocked before tapping it.
 */
export function MafiaSettingsPanel({
  room,
  myPlayer,
  onSaveGameSettings,
}: MafiaSettingsPanelProps) {
  const isHost = myPlayer.isHost;
  const settings = room.gameSettings.mafia;
  const playerCount = room.players.length;
  const validation = validateMafiaSettings(playerCount, settings);
  const breakdown = validation.breakdown;

  const emit = (patch: Partial<MafiaSettings>) => {
    if (!isHost) return;
    onSaveGameSettings?.({ mafia: patch }, () => {});
  };

  const isAuto = settings.mafiaCount === 'auto';
  const mafiaCount = breakdown.mafia;
  const countCeiling = 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="party-card p-4 rounded-2xl space-y-3"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
          <Settings2 className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-black text-[var(--text-primary)] block leading-tight">
            Mafia Settings
          </span>
          <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            {isHost ? 'Applied to the next game' : 'Chosen by the host'}
          </p>
        </div>
      </div>

      {/* Timers */}
      {TIMERS.map((timer) => {
        const value = settings[timer.key];
        return (
          <div key={timer.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Timer className="w-3 h-3" />
                <span>{timer.label}</span>
              </span>
              <span className="text-xs font-black text-[var(--text-primary)]">{value}s</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!isHost || value <= timer.limits.min}
                onClick={() =>
                  emit({ [timer.key]: Math.max(timer.limits.min, value - timer.step) })
                }
                aria-label={`Decrease ${timer.label} time`}
                className="w-10 h-10 rounded-xl border-2 border-[var(--border-subtle)] font-black text-lg text-[var(--text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                −
              </button>

              <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all"
                  style={{
                    width: `${
                      ((value - timer.limits.min) / (timer.limits.max - timer.limits.min)) * 100
                    }%`,
                  }}
                />
              </div>

              <button
                type="button"
                disabled={!isHost || value >= timer.limits.max}
                onClick={() =>
                  emit({ [timer.key]: Math.min(timer.limits.max, value + timer.step) })
                }
                aria-label={`Increase ${timer.label} time`}
                className="w-10 h-10 rounded-xl border-2 border-[var(--border-subtle)] font-black text-lg text-[var(--text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>

            <p className="text-[10px] font-semibold text-neutral-400 mt-1">
              {timer.help} ({timer.limits.min}–{timer.limits.max}s)
            </p>
          </div>
        );
      })}

      {/* Mafia count */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Skull className="w-3 h-3" />
            <span>Mafia in the deal</span>
          </span>
          <span className="text-xs font-black text-[var(--text-primary)]">
            {isAuto ? `Auto · ${mafiaCount}` : mafiaCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!isHost || isAuto}
            onClick={() => emit({ mafiaCount: 'auto' })}
            className={`px-3 h-10 rounded-xl border-2 text-[11px] font-black transition-all ${
              isAuto
                ? 'border-rose-500 bg-rose-500/10 text-[var(--text-primary)]'
                : 'border-[var(--border-subtle)] text-neutral-500 dark:text-neutral-400'
            } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
          >
            Auto
          </button>

          <button
            type="button"
            disabled={!isHost || (!isAuto && mafiaCount <= 1)}
            onClick={() =>
              emit({ mafiaCount: Math.max(1, (isAuto ? mafiaCount : mafiaCount) - 1) })
            }
            aria-label="Fewer Mafia"
            className="w-10 h-10 rounded-xl border-2 border-[var(--border-subtle)] font-black text-lg text-[var(--text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            −
          </button>

          <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-rose-500 transition-all"
              style={{ width: `${(mafiaCount / countCeiling) * 100}%` }}
            />
          </div>

          <button
            type="button"
            disabled={!isHost || mafiaCount >= countCeiling}
            onClick={() =>
              emit({ mafiaCount: Math.min(countCeiling, (isAuto ? mafiaCount : mafiaCount) + 1) })
            }
            aria-label="More Mafia"
            className="w-10 h-10 rounded-xl border-2 border-[var(--border-subtle)] font-black text-lg text-[var(--text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        <p className="text-[10px] font-semibold text-neutral-400 mt-1">
          Auto deals one Mafia per four players, always fewer than half the table.
        </p>
      </div>

      {/* Role toggles */}
      <div className="space-y-2">
        <ToggleRow
          icon={<Search className="w-3.5 h-3.5" />}
          label="Detective"
          detail={
            playerCount >= 4
              ? 'Investigates one player each night.'
              : 'Needs at least 4 players.'
          }
          checked={settings.detective}
          disabled={!isHost || playerCount < 4}
          onChange={(value) => emit({ detective: value })}
        />
        <ToggleRow
          icon={<HeartPulse className="w-3.5 h-3.5" />}
          label="Doctor"
          detail={
            playerCount >= 6
              ? 'Protects one player each night, never twice in a row.'
              : 'Needs at least 6 players.'
          }
          checked={settings.doctor}
          disabled={!isHost || playerCount < 6}
          onChange={(value) => emit({ doctor: value })}
        />
        <ToggleRow
          icon={<Eye className="w-3.5 h-3.5" />}
          label="Reveal role on death"
          detail="Announce the role of players who are killed or exiled."
          checked={settings.revealRoleOnDeath}
          disabled={!isHost}
          onChange={(value) => emit({ revealRoleOnDeath: value })}
        />
      </div>

      {/* The deal the server will make */}
      <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-[var(--border-subtle)]">
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-1.5">
          <Users className="w-3 h-3" />
          <span>
            This deal · {playerCount} {playerCount === 1 ? 'player' : 'players'}
          </span>
        </span>

        <div className="flex flex-wrap gap-1.5">
          <DealPill label={`${breakdown.mafia} Mafia`} tone="mafia" />
          <DealPill
            label={breakdown.detective ? '1 Detective' : 'No Detective'}
            tone={breakdown.detective ? 'special' : 'muted'}
          />
          <DealPill
            label={breakdown.doctor ? '1 Doctor' : 'No Doctor'}
            tone={breakdown.doctor ? 'special' : 'muted'}
          />
          <DealPill label={`${breakdown.townsperson} Townspeople`} tone="town" />
        </div>

        {!validation.valid && (
          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-2">
            {validation.error}
          </p>
        )}
      </div>

      {!isHost && (
        <p className="text-[10px] font-semibold text-neutral-400">
          The host can change these between games.
        </p>
      )}
    </motion.div>
  );
}

function ToggleRow({
  icon,
  label,
  detail,
  checked,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left transition-all ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'
      } ${
        checked
          ? 'border-rose-500/70 bg-rose-500/5'
          : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60'
      }`}
    >
      <span
        className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
          checked ? 'bg-rose-500/15 text-rose-500' : 'bg-neutral-500/10 text-neutral-400'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-xs font-black text-[var(--text-primary)] block leading-tight">
          {label}
        </span>
        <span className="text-[10px] font-semibold text-neutral-400 block leading-snug">
          {detail}
        </span>
      </span>
      <span
        className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors ${
          checked ? 'bg-rose-500' : 'bg-neutral-300 dark:bg-neutral-700'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </span>
    </button>
  );
}

function DealPill({ label, tone }: { label: string; tone: 'mafia' | 'special' | 'town' | 'muted' }) {
  const styles: Record<typeof tone, string> = {
    mafia: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
    special: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
    town: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    muted: 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20',
  };
  return (
    <span className={`px-2 py-1 rounded-lg border text-[11px] font-black ${styles[tone]}`}>
      {label}
    </span>
  );
}
