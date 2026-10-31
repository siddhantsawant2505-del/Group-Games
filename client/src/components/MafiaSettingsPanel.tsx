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
      className="bg-white border-[2.5px] border-[var(--border-neo)] shadow-[5px_5px_0px_var(--border-neo)] p-5 rounded-3xl space-y-4"
    >
      <div className="flex items-center gap-2.5 pb-2 border-b-2 border-[#18181B]/10">
        <div className="w-10 h-10 rounded-2xl bg-[#C4B5FD] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-center shrink-0 font-black">
          <Settings2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <span className="text-base font-black text-[var(--text-primary)] block leading-tight">
            Mafia Settings
          </span>
          <p className="text-xs font-bold text-[#52525B]">
            {isHost ? 'Applied to the next game' : 'Chosen by the host'}
          </p>
        </div>
      </div>

      {/* Timers */}
      {TIMERS.map((timer) => {
        const value = settings[timer.key];
        return (
          <div key={timer.key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-[#18181B]" />
                <span>{timer.label}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF8F5] border border-[var(--border-neo)] text-xs font-black text-[var(--text-primary)] font-mono">
                {value}s
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={!isHost || value <= timer.limits.min}
                onClick={() =>
                  emit({ [timer.key]: Math.max(timer.limits.min, value - timer.step) })
                }
                aria-label={`Decrease ${timer.label} time`}
                className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
              >
                −
              </button>

              <div className="flex-1 h-3 rounded-full bg-[#F3EFEA] border-2 border-[var(--border-neo)] overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-[#C4B5FD] border border-[var(--border-neo)] transition-all"
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
                className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
              >
                +
              </button>
            </div>

            <p className="text-[11px] font-bold text-[#52525B] mt-1">
              {timer.help} ({timer.limits.min}–{timer.limits.max}s)
            </p>
          </div>
        );
      })}

      {/* Mafia count */}
      <div className="pt-2 border-t-2 border-[#18181B]/10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
            <Skull className="w-3.5 h-3.5 text-[#18181B]" />
            <span>Mafia in the Deal</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF8F5] border border-[var(--border-neo)] text-xs font-black text-[var(--text-primary)] font-mono">
            {isAuto ? `Auto · ${mafiaCount}` : mafiaCount}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={!isHost || isAuto}
            onClick={() => emit({ mafiaCount: 'auto' })}
            className={`px-3.5 h-10 rounded-xl text-xs font-black transition-all ${
              isAuto
                ? 'border-[2.5px] border-[var(--border-neo)] bg-[#FDA4AF] text-[#18181B] shadow-[2px_2px_0px_var(--border-neo)] -translate-x-0.5 -translate-y-0.5'
                : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5] text-[#52525B]'
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
            className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
          >
            −
          </button>

          <div className="flex-1 h-3 rounded-full bg-[#F3EFEA] border-2 border-[var(--border-neo)] overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-[#FDA4AF] border border-[var(--border-neo)] transition-all"
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
            className="w-10 h-10 rounded-xl border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A] hover:bg-[#FDE047] text-[#18181B] font-black text-xl shadow-[2px_2px_0px_var(--border-neo)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-35 disabled:bg-[#F3EFEA] disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
          >
            +
          </button>
        </div>

        <p className="text-[11px] font-bold text-[#52525B] mt-1">
          Auto deals one Mafia per four players, always fewer than half the table.
        </p>
      </div>

      {/* Role toggles */}
      <div className="pt-2 border-t-2 border-[#18181B]/10 space-y-2.5">
        <ToggleRow
          icon={<Search className="w-4 h-4 text-[#18181B]" />}
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
          icon={<HeartPulse className="w-4 h-4 text-[#18181B]" />}
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
          icon={<Eye className="w-4 h-4 text-[#18181B]" />}
          label="Reveal Role on Death"
          detail="Announce the role of players who are killed or exiled."
          checked={settings.revealRoleOnDeath}
          disabled={!isHost}
          onChange={(value) => emit({ revealRoleOnDeath: value })}
        />
      </div>

      {/* The deal the server will make */}
      <div className="p-4 rounded-2xl bg-[#FAF8F5] border-[2.5px] border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)]">
        <span className="text-xs font-black uppercase tracking-wider text-[#18181B] flex items-center gap-1.5 mb-2">
          <Users className="w-3.5 h-3.5 text-[#18181B]" />
          <span>
            This Deal · {playerCount} {playerCount === 1 ? 'player' : 'players'}
          </span>
        </span>

        <div className="flex flex-wrap gap-2">
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
          <div className="p-2.5 rounded-xl bg-[#FDA4AF] border-2 border-[var(--border-neo)] text-xs font-black text-[#18181B] mt-2.5">
            {validation.error}
          </div>
        )}
      </div>

      {!isHost && (
        <p className="text-[11px] font-bold text-[#52525B]">
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
      className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'
      } ${
        checked
          ? 'border-[2.5px] border-[var(--border-neo)] bg-[#FEF08A]/40 shadow-[2px_2px_0px_var(--border-neo)]'
          : 'border-2 border-[var(--border-neo)]/40 bg-[#FAF8F5]'
      }`}
    >
      <span
        className={`shrink-0 w-8 h-8 rounded-xl border border-[var(--border-neo)] flex items-center justify-center ${
          checked ? 'bg-[#C4B5FD] shadow-[1px_1px_0px_var(--border-neo)]' : 'bg-white'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="text-xs font-black text-[var(--text-primary)] block leading-tight">
          {label}
        </span>
        <span className="text-[11px] font-bold text-[#52525B] block leading-snug">
          {detail}
        </span>
      </span>
      <span
        className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors border-2 border-[var(--border-neo)] ${
          checked ? 'bg-[#86EFAC]' : 'bg-[#E4E4E7]'
        }`}
      >
        <span
          className={`block w-4.5 h-4.5 rounded-full bg-white border border-[var(--border-neo)] shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

function DealPill({ label, tone }: { label: string; tone: 'mafia' | 'special' | 'town' | 'muted' }) {
  const styles: Record<typeof tone, string> = {
    mafia: 'bg-[#FDA4AF] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1.5px_1.5px_0px_var(--border-neo)]',
    special: 'bg-[#93C5FD] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1.5px_1.5px_0px_var(--border-neo)]',
    town: 'bg-[#86EFAC] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1.5px_1.5px_0px_var(--border-neo)]',
    muted: 'bg-[#F3EFEA] text-[#71717A] border-2 border-[var(--border-neo)]/40',
  };
  return (
    <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${styles[tone]}`}>
      {label}
    </span>
  );
}
