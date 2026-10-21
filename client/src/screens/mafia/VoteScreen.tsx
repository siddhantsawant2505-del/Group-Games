import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Lock, MinusCircle, Vote } from 'lucide-react';
import { Player, PlayerPrivateState, RoomPublicState } from '@shared/types';
import { Timer } from '../../components/Timer';
import { ActionButton } from '../../components/ActionButton';
import { PlayerChip } from '../../components/PlayerChip';

const SKIP_VOTE = 'skip';

interface VoteScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onVote: (targetPlayerId: string) => void;
  onHostSkip: () => void;
}

/**
 * Mafia — Vote.
 * A secret ballot over the living players plus Skip. The tally stays hidden until
 * the exile screen, so no one can read the room from the phone.
 */
export function VoteScreen({ room, myPlayer, privateState, onVote, onHostSkip }: VoteScreenProps) {
  const state = room.mafiaState;
  const alive = state?.alivePlayerIds ?? room.players.map((player) => player.id);
  const isAlive = privateState.mafiaIsAlive !== false;
  const hasVoted = Boolean(privateState.mafiaVoteSubmitted);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const livingPlayers = room.players.filter((player) => alive.includes(player.id));
  const lockedCount = livingPlayers.filter((player) => room.hasVoted.includes(player.id)).length;
  const selectedName =
    selectedId === SKIP_VOTE
      ? 'Skip'
      : room.players.find((player) => player.id === selectedId)?.name ?? null;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
            <Vote className="w-3.5 h-3.5" />
            <span>Vote · Day {state?.dayNumber ?? 1}</span>
          </span>
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Secret ballot</span>
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Voting Deadline"
          />
        )}

        <p className="text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {lockedCount} of {livingPlayers.length} ballots locked in
        </p>
      </div>

      <div className="my-auto">
        {!isAlive ? (
          <div className="party-card p-6 rounded-3xl text-center">
            <h2 className="text-xl font-black text-[var(--text-primary)] mb-1">
              The village is voting
            </h2>
            <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
              You are out of the game and cannot vote. The tally appears when the ballot closes.
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="party-card p-5 rounded-3xl space-y-3"
          >
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                Who leaves the village?
              </span>
              <p className="text-xs font-semibold text-neutral-400">
                A tie for first, or Skip at the top, exiles nobody.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {livingPlayers.map((player) => (
                <PlayerChip
                  key={player.id}
                  name={player.name}
                  colorIndex={player.colorIndex}
                  isHost={player.isHost}
                  isYou={player.id === myPlayer.id}
                  size="md"
                  selectable={!hasVoted && player.id !== myPlayer.id}
                  selected={selectedId === player.id}
                  onClick={() => {
                    if (!hasVoted && player.id !== myPlayer.id) setSelectedId(player.id);
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              disabled={hasVoted}
              onClick={() => setSelectedId(SKIP_VOTE)}
              className={`w-full p-3 rounded-2xl border-2 flex items-center gap-2.5 text-left transition-all ${
                selectedId === SKIP_VOTE
                  ? 'border-neutral-800 dark:border-neutral-200 bg-neutral-100 dark:bg-neutral-800/70'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-card-subtle)]'
              } ${hasVoted ? 'cursor-default opacity-70' : 'cursor-pointer active:scale-[0.99]'}`}
            >
              <MinusCircle className="w-5 h-5 text-neutral-400 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-black text-[var(--text-primary)]">
                  Skip this vote
                </span>
                <span className="block text-[10px] font-semibold text-neutral-400">
                  Exile nobody today
                </span>
              </span>
            </button>

            {hasVoted ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <span className="text-sm font-black text-emerald-800 dark:text-emerald-200 block">
                    Ballot locked in
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    You voted for <strong>{privateState.mafiaVoteTargetName ?? 'someone'}</strong>.
                  </span>
                </div>
              </div>
            ) : (
              <ActionButton
                variant="personal"
                playerColorIndex={myPlayer.colorIndex}
                disabled={!selectedId}
                onClick={() => selectedId && onVote(selectedId)}
                icon={<Lock className="w-5 h-5" />}
                subtext={
                  selectedName ? `Confirm a ballot for ${selectedName}` : 'Pick a player or Skip'
                }
              >
                Lock In Ballot
              </ActionButton>
            )}

            <p className="text-[10px] font-semibold text-neutral-400 text-center">
              Nothing is shown to anyone until the tally.
            </p>
          </motion.div>
        )}
      </div>

      <div className="pt-3">
        {myPlayer.isHost ? (
          <button
            type="button"
            onClick={onHostSkip}
            className="w-full text-[11px] font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
          >
            Host: close the ballot now
          </button>
        ) : (
          <p className="text-xs text-center font-semibold text-neutral-400">
            The ballot closes when everyone has voted, or when the timer ends.
          </p>
        )}
      </div>
    </div>
  );
}
