import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Copy, Gavel, ListOrdered, Sparkles, X } from 'lucide-react';
import { Player, RoomPublicState, Top100GuessRow } from '@shared/types';
import { ActionButton } from '../../components/ActionButton';
import { PlayerAvatar } from '../../components/PlayerAvatar';

interface Top100GuessesRevealScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  /** Host-only: force a guess to a list position, or null for "not on the list". */
  onOverrule: (rowId: string, rank: number | null) => void;
  /** Host-only: apply the points and open the slices screen. */
  onContinue: () => void;
}

/** Counts a number up when it appears — the points land with a beat. */
function useCountUp(target: number, durationMs = 550): number {
  const [value, setValue] = useState(target <= 0 ? 0 : 0);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

function PointsBadge({ points, muted }: { points: number; muted: boolean }) {
  const value = useCountUp(points);
  return (
    <span
      className={`shrink-0 text-lg font-black tabular-nums ${
        muted ? 'text-neutral-400' : 'text-emerald-600 dark:text-emerald-400'
      }`}
    >
      {value}
      <span className="text-[10px] font-bold text-neutral-400 ml-0.5">pts</span>
    </span>
  );
}

/** One guess, with the host's overrule controls when the host is looking. */
function GuessRow({
  row,
  isHost,
  isMine,
  player,
  onOverrule,
}: {
  row: Top100GuessRow;
  isHost: boolean;
  isMine: boolean;
  player?: Player;
  onOverrule: (rowId: string, rank: number | null) => void;
}) {
  const [rankDraft, setRankDraft] = useState(row.matchedRank ? String(row.matchedRank) : '');

  useEffect(() => {
    setRankDraft(row.matchedRank ? String(row.matchedRank) : '');
  }, [row.matchedRank]);

  const onList = row.matchedRank !== null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-3 rounded-2xl border-2 flex flex-col gap-2"
      style={{
        borderColor: isMine
          ? 'var(--border-strong, var(--border-subtle))'
          : 'var(--border-subtle)',
        backgroundColor: onList ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-card-subtle)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <PlayerAvatar
          name={row.teamName || row.name}
          colorIndex={row.colorIndex}
          size="sm"
          isHost={player?.isHost}
        />

        <div className="min-w-0 flex-1 text-left">
          <span className="text-xs font-extrabold text-[var(--text-primary)] block leading-tight truncate">
            {row.teamName ? `${row.teamName} (team)` : row.name}
            {isMine && ' (You)'}
            {row.duplicate && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-black text-amber-600 dark:text-amber-400">
                <Copy className="w-3 h-3" />
                dup
              </span>
            )}
            {row.overruled && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-black text-sky-600 dark:text-sky-400">
                <Gavel className="w-3 h-3" />
                host call
              </span>
            )}
          </span>
          <span className="text-base font-black text-[var(--text-primary)] block break-words">
            “{row.text}”
          </span>
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
            {onList
              ? `#${row.matchedRank} · ${row.matchedName}`
              : row.text === '(no answer)'
              ? 'No guess locked'
              : 'Not on the list'}
          </span>
        </div>

        <PointsBadge points={row.points} muted={row.points === 0} />
      </div>

      {isHost && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
            Overrule
          </span>
          <input
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            value={rankDraft}
            onChange={(event) => setRankDraft(event.target.value)}
            aria-label={`Force ${row.name} to a list position`}
            className="w-16 px-2 py-1 rounded-lg border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-xs font-black text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const parsed = Math.round(Number(rankDraft));
              if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) return;
              onOverrule(row.rowId, parsed);
            }}
            disabled={!rankDraft}
            aria-label={`Set position for ${row.name}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-[var(--border-subtle)] text-[11px] font-black text-[var(--text-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <Check className="w-3 h-3" />
            Set
          </button>
          <button
            type="button"
            onClick={() => onOverrule(row.rowId, null)}
            aria-label={`Mark ${row.name} as not on the list`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-[var(--border-subtle)] text-[11px] font-black text-neutral-500 dark:text-neutral-400 cursor-pointer"
          >
            <X className="w-3 h-3" />
            Off list
          </button>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Top 100 — Guesses Board (reveal-answers phase).
 * Every guess with its match, position and points (shallowest first), plus the
 * host's per-guess overrule before the round's points are finalised.
 */
export function Top100GuessesRevealScreen({
  room,
  myPlayer,
  onOverrule,
  onContinue,
}: Top100GuessesRevealScreenProps) {
  const state = room.top100State;
  if (!state) return null;

  const rows = [...state.guesses].sort((a, b) => a.points - b.points || a.name.localeCompare(b.name));
  const onList = rows.filter((row) => row.matchedRank !== null).length;
  const isTeamMode = room.playMode === 'team' && room.teams.length > 0;
  const myRowId = isTeamMode ? myPlayer.teamId : myPlayer.id;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div className="pb-3 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-black text-neutral-600 dark:text-neutral-400 mb-2">
          <ListOrdered className="w-3.5 h-3.5" />
          <span>
            Round {state.roundNumber} of {state.roundCount} — The Guesses
          </span>
        </span>
        <h2 className="text-base font-black text-[var(--text-primary)] leading-snug break-words">
          {state.question}
        </h2>
        <p className="text-[11px] font-semibold text-neutral-400 mt-1">
          {onList} of {rows.length} guesses are on the list · shallowest first
        </p>
      </div>

      <div className="space-y-2 overflow-y-auto">
        {rows.map((row) => (
          <GuessRow
            key={row.rowId}
            row={row}
            isHost={myPlayer.isHost}
            isMine={row.rowId === myRowId}
            player={room.players.find((candidate) => candidate.id === row.ownerId)}
            onOverrule={onOverrule}
          />
        ))}
      </div>

      <div className="pt-3 space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>
            {myPlayer.isHost
              ? 'Overrule a close call, then Continue to lock the points.'
              : 'The host confirms the matches, then the slices are revealed.'}
          </span>
        </div>

        {myPlayer.isHost && (
          <ActionButton
            variant="personal"
            playerColorIndex={myPlayer.colorIndex}
            onClick={onContinue}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Points become final"
          >
            Continue
          </ActionButton>
        )}
      </div>
    </div>
  );
}
