import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Lock } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '../types';
import { Timer } from '../components/Timer';
import { PlayerChip } from '../components/PlayerChip';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { ActionButton } from '../components/ActionButton';
import { getPlayerColor } from '../theme/tokens';

interface VotePhaseScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onCastVote: (targetPlayerId: string) => void;
  onHostSkip?: () => void;
}

export function VotePhaseScreen({
  room,
  myPlayer,
  privateState,
  onCastVote,
  onHostSkip,
}: VotePhaseScreenProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(
    privateState.votedForPlayerId || null
  );
  const [isPending, setIsPending] = useState(false);

  const hasVoted = Boolean(
    privateState.voteSubmitted || room.hasVoted.includes(myPlayer.id)
  );

  const playerColor = getPlayerColor(myPlayer.colorIndex);

  const handleVoteSubmit = () => {
    if (!selectedTargetId || isPending) return;
    setIsPending(true);
    onCastVote(selectedTargetId);
  };

  const votedTargetPlayer = room.players.find((p) => p.id === (privateState.votedForPlayerId || selectedTargetId));

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header and Timer */}
      <div>
        <div className="text-center mb-2">
          {/* Highlight with player's identity color */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black mb-1"
            style={{
              backgroundColor: `${playerColor.hex}18`,
              borderColor: playerColor.hex,
              color: 'var(--text-primary)',
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: playerColor.hex }}
            />
            <span>Cast your accusation</span>
          </div>

          <h2 className="text-2xl font-black text-[var(--text-primary)]">
            Vote for Suspect
          </h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {room.hasVoted.length} of {room.players.length} votes locked in
          </p>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Voting Deadline"
          />
        )}
      </div>

      {/* Main Voting Grid */}
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="party-card p-5 rounded-3xl my-auto space-y-4"
      >
        <div className="text-left">
          <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-1">
            Choose a Player to Accuse
          </span>
          <p className="text-xs text-neutral-400">
            Tap a player chip to select who you think is the Impostor
          </p>
        </div>

        {/* Player options to vote for with their submitted clues */}
        <div className="grid grid-cols-1 gap-2.5">
          {room.players.map((p) => {
            const isMe = p.id === myPlayer.id;
            const isSelected = selectedTargetId === p.id;
            const targetColor = getPlayerColor(p.colorIndex);
            const clueItem = room.revealedAnswers.find((a) => a.playerId === p.id);
            const clueText = clueItem?.answerText || '(No clue)';

            return (
              <button
                key={p.id}
                type="button"
                disabled={hasVoted}
                onClick={() => {
                  if (!hasVoted) {
                    setSelectedTargetId(p.id);
                  }
                }}
                className={`w-full p-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-left ${
                  hasVoted ? 'cursor-default' : 'cursor-pointer active:scale-[0.99]'
                } ${
                  isSelected
                    ? 'bg-neutral-50 dark:bg-neutral-800/90 shadow-md'
                    : 'bg-white dark:bg-neutral-900/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                }`}
                style={{
                  borderColor: isSelected ? targetColor.hex : 'var(--border-subtle)',
                  boxShadow: isSelected ? `0 4px 16px ${targetColor.hex}25` : undefined,
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <PlayerAvatar
                      name={p.name}
                      colorIndex={p.colorIndex}
                      size="sm"
                      isHost={p.isHost}
                    />
                    {isSelected && (
                      <span
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center"
                        style={{ backgroundColor: targetColor.hex }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-sm text-[var(--text-primary)] block truncate">
                      {p.name}
                      {isMe && ' (You)'}
                    </span>
                    <span className="text-xs text-neutral-400 font-medium block">
                      {p.isHost ? 'Host' : 'Suspect'}
                    </span>
                  </div>
                </div>

                {/* Submitted clue next to player's name */}
                <div className="shrink-0 text-right">
                  <span className="text-xs text-neutral-400 block font-semibold mb-0.5">
                    Clue:
                  </span>
                  <span
                    className="inline-block px-2.5 py-1 rounded-xl text-xs font-black border"
                    style={{
                      backgroundColor: isSelected ? `${targetColor.hex}18` : 'var(--surface-card-subtle)',
                      borderColor: isSelected ? `${targetColor.hex}50` : 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    "{clueText}"
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Lock in status */}
        {hasVoted ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-3 text-emerald-800 dark:text-emerald-200"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            <div>
              <span className="text-sm font-black block">
                Vote Locked In!
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                You voted for <strong>{votedTargetPlayer?.name || 'suspect'}</strong>
              </span>
            </div>
          </motion.div>
        ) : (
          <ActionButton
            variant="personal"
            playerColorIndex={myPlayer.colorIndex}
            disabled={!selectedTargetId}
            loading={isPending && !hasVoted}
            loadingText="Casting Accusation..."
            onClick={handleVoteSubmit}
            icon={<Lock className="w-5 h-5" />}
            subtext={
              selectedTargetId
                ? `Confirm accusation for ${votedTargetPlayer?.name || 'player'}`
                : 'Select a player chip above to vote'
            }
          >
            Lock In Vote
          </ActionButton>
        )}
      </motion.div>

      {/* Host skip if waiting */}
      {myPlayer.isHost && onHostSkip && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={onHostSkip}
            className="text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
          >
            Host: Skip to results immediately
          </button>
        </div>
      )}
    </div>
  );
}
