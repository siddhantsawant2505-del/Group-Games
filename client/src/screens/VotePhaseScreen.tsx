import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Lock } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { PlayerChip } from '../components/PlayerChip';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { ActionButton } from '../components/ActionButton';
import { getPlayerColor } from '@shared/theme/tokens';

/**
 * Optional copy overrides so a game can reuse the same secret ballot with its
 * own framing. Reverse Categories votes for the best invented category rather
 * than accusing an impostor. Every field falls back to the impostor wording.
 */
export interface VoteCopy {
  badge?: string;
  title?: string;
  pickLabel?: string;
  pickHint?: string;
  /** Prefix shown before the candidate's submitted answer. */
  answerLabel?: string;
  missingAnswerLabel?: string;
  /** Small label under a candidate's name ("Suspect", "Category author", ...). */
  targetRoleLabel?: string;
  /** Confirmation button subtext prefix, e.g. "Confirm accusation for". */
  confirmLabel?: string;
  selectHint?: string;
  actionLabel?: string;
  actionLoadingLabel?: string;
  lockedTitle?: string;
  /** Text before the locked-in target's name, e.g. "You voted for". */
  lockedPrefix?: string;
}

interface VotePhaseScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onCastVote: (targetPlayerId: string) => void;
  onHostSkip?: () => void;
  /** When set, only these players may be accused (Mafia day ballots exclude the dead). */
  eligiblePlayerIds?: string[];
  copy?: VoteCopy;
}

export function VotePhaseScreen({
  room,
  myPlayer,
  privateState,
  onCastVote,
  onHostSkip,
  eligiblePlayerIds,
  copy = {},
}: VotePhaseScreenProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(
    privateState.votedForPlayerId || null
  );
  const [isPending, setIsPending] = useState(false);

  const hasVoted = Boolean(
    privateState.voteSubmitted || room.hasVoted.includes(myPlayer.id)
  );

  const playerColor = getPlayerColor(myPlayer.colorIndex);

  // Mafia ballots only list players still in the game, so a vote always counts.
  const votePool = eligiblePlayerIds
    ? room.players.filter((p) => eligiblePlayerIds.includes(p.id))
    : room.players;

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
            <span>{copy.badge || 'Cast your accusation'}</span>
          </div>

          <h2 className="text-2xl font-black text-[var(--text-primary)]">
            {copy.title || 'Vote for Suspect'}
          </h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {room.hasVoted.length} of {votePool.length} votes locked in
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
            {copy.pickLabel || 'Choose a Player to Accuse'}
          </span>
          <p className="text-xs text-neutral-400">
            {copy.pickHint || 'Tap a player chip to select who you think is the Impostor'}
          </p>
        </div>

        {/* Player options to vote for with their submitted clues */}
        <div className="grid grid-cols-1 gap-2.5">
          {votePool.map((p) => {
            const isMe = p.id === myPlayer.id;
            const isSelected = selectedTargetId === p.id;
            const targetColor = getPlayerColor(p.colorIndex);
            const clueItem = room.revealedAnswers.find((a) => a.playerId === p.id);
            const clueText = clueItem?.answerText || copy.missingAnswerLabel || '(No clue)';

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
                      {p.isHost ? 'Host' : copy.targetRoleLabel || 'Suspect'}
                    </span>
                  </div>
                </div>

                {/* Submitted clue next to player's name */}
                <div className="shrink-0 text-right">
                  <span className="text-xs text-neutral-400 block font-semibold mb-0.5">
                    {copy.answerLabel || 'Clue:'}
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
                {copy.lockedTitle || 'Vote Locked In!'}
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                {copy.lockedPrefix || 'You voted for'}{' '}
                <strong>{votedTargetPlayer?.name || 'suspect'}</strong>
              </span>
            </div>
          </motion.div>
        ) : (
          <ActionButton
            variant="personal"
            playerColorIndex={myPlayer.colorIndex}
            disabled={!selectedTargetId}
            loading={isPending && !hasVoted}
            loadingText={copy.actionLoadingLabel || 'Casting Accusation...'}
            onClick={handleVoteSubmit}
            icon={<Lock className="w-5 h-5" />}
            subtext={
              selectedTargetId
                ? `${copy.confirmLabel || 'Confirm accusation for'} ${votedTargetPlayer?.name || 'player'}`
                : copy.selectHint || 'Select a player chip above to vote'
            }
          >
            {copy.actionLabel || 'Lock In Vote'}
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
