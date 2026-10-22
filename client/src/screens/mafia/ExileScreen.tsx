import { motion } from 'motion/react';
import { ArrowRight, Gavel, MinusCircle } from 'lucide-react';
import { MAFIA_ROLE_LABELS, Player, PlayerPrivateState, RoomPublicState } from '@shared/types';
import { Timer } from '../../components/Timer';
import { PlayerAvatar } from '../../components/PlayerAvatar';

interface ExileScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
}

/**
 * Mafia — Exile.
 * The secret ballots are opened and the village sees who voted for whom, then the
 * outcome: an exile (with the role only if the host allowed it) or nobody.
 */
export function ExileScreen({ room, myPlayer, privateState }: ExileScreenProps) {
  const state = room.mafiaState;
  const exiledName = state?.lastExiledName ?? null;
  const exiledRole = state?.lastExiledRole ?? null;
  const exiledId = state?.lastExiledId ?? null;
  const exiledPlayer = room.players.find((player) => player.id === exiledId) ?? null;
  const breakdown = state?.voteBreakdown ?? [];
  const tally = state?.voteTally ?? {};
  const skipped = state?.skippedVoteCount ?? 0;
  const topCount = Math.max(0, ...Object.values(tally));
  const isAlive = privateState.mafiaIsAlive !== false;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
            <Gavel className="w-3.5 h-3.5" />
            <span>Exile · Day {state?.dayNumber ?? 1}</span>
          </span>
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            {isAlive ? 'Your village' : 'Spectating'}
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="The Verdict"
          />
        )}
      </div>

      <div className="my-auto space-y-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-5 rounded-3xl border ${
            exiledName
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-emerald-500/40 bg-emerald-500/5'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
            Outcome
          </span>

          {exiledPlayer ? (
            <div className="flex items-center gap-3">
              <PlayerAvatar
                name={exiledPlayer.name}
                colorIndex={exiledPlayer.colorIndex}
                size="lg"
              />
              <div className="min-w-0">
                <h2 className="text-xl font-black text-[var(--text-primary)] leading-tight">
                  {exiledPlayer.name} is exiled
                </h2>
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  {exiledRole
                    ? `They were the ${MAFIA_ROLE_LABELS[exiledRole]}.`
                    : 'Their role stays a secret.'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                <MinusCircle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-black text-[var(--text-primary)] leading-tight">
                  Nobody is exiled
                </h2>
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  {skipped > 0 && skipped >= topCount
                    ? 'The village chose to skip.'
                    : 'The vote was tied.'}
                </span>
              </div>
            </div>
          )}

          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-3 leading-relaxed">
            {state?.exileNarration}
          </p>
        </motion.div>

        {/* The tally, voter by voter */}
        <div className="party-card p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
              The tally
            </span>
            <span className="text-[10px] font-bold text-neutral-400">
              {breakdown.length} ballots · {skipped} skip
            </span>
          </div>

          <div className="space-y-1.5">
            {breakdown.map((row, index) => (
              <motion.div
                key={`${row.voterId}-${row.targetId}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index }}
                className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${
                  row.targetId === exiledId && exiledId
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-card-subtle)]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerAvatar name={row.voterName} colorIndex={row.voterColorIndex} size="xs" />
                  <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                    {row.voterName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-black">
                  <ArrowRight className="w-3 h-3 text-neutral-400" />
                  <span className="text-[var(--text-primary)]">{row.targetName}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {tally[row.targetId] ?? 0}
                  </span>
                </div>
              </motion.div>
            ))}

            {breakdown.length === 0 && (
              <p className="text-[11px] font-semibold text-neutral-400">
                No ballots were cast.
              </p>
            )}
          </div>
        </div>

        {myPlayer.isHost && (
          <p className="text-[10px] text-center font-semibold text-neutral-400">
            Night {state?.nightNumber ? state.nightNumber + 1 : 2} begins automatically.
          </p>
        )}
      </div>

      <div className="pt-2" />
    </div>
  );
}
