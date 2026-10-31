import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Lock } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { ActionButton } from '../components/ActionButton';
import { getPlayerColor } from '@shared/theme/tokens';

export interface VoteCopy {
  badge?: string;
  title?: string;
  pickLabel?: string;
  pickHint?: string;
  answerLabel?: string;
  missingAnswerLabel?: string;
  targetRoleLabel?: string;
  confirmLabel?: string;
  selectHint?: string;
  actionLabel?: string;
  actionLoadingLabel?: string;
  lockedTitle?: string;
  lockedPrefix?: string;
}

interface VotePhaseScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onCastVote: (targetPlayerId: string) => void;
  onHostSkip?: () => void;
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
    <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
      {/* Header and Timer */}
      <div>
        <div className="text-center mb-2">
          {/* Highlight badge with player's identity color */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-xl border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black mb-1.5"
            style={{
              backgroundColor: playerColor.hex,
              color: playerColor.contrastText,
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full border border-[var(--border-neo)]"
              style={{ backgroundColor: '#18181B' }}
            />
            <span>{copy.badge || 'Cast your accusation'}</span>
          </div>

          <h2 className="text-2xl font-black text-[var(--text-primary)]">
            {copy.title || 'Vote for Suspect'}
          </h2>
          <p className="text-xs font-bold opacity-65">
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
        className="p-5 rounded-3xl my-auto space-y-4 bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[6px_6px_0px_var(--border-neo)]"
      >
        <div className="text-left">
          <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] block mb-1">
            {copy.pickLabel || 'Choose a Player to Accuse'}
          </span>
          <p className="text-xs font-semibold opacity-60">
            {copy.pickHint || 'Tap a player chip to select who you think is the Impostor'}
          </p>
        </div>

        {/* Player options to vote for with their submitted clues */}
        <div className="grid grid-cols-1 gap-2.5">
          {votePool.map((p) => {
            const isMe = p.id === myPlayer.id;
            const isSelected = selectedTargetId === p.id;
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
                className={`w-full p-3.5 rounded-2xl border-[2.5px] border-[var(--border-neo)] transition-all flex items-center justify-between gap-3 text-left select-none ${
                  hasVoted ? 'cursor-default' : 'cursor-pointer tactile-btn'
                } ${
                  isSelected
                    ? 'bg-[#FEF08A] shadow-[4px_4px_0px_var(--border-neo)] -translate-y-0.5'
                    : 'bg-[var(--surface-card)] shadow-[2px_2px_0px_var(--border-neo)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <PlayerAvatar
                      name={p.name}
                      colorIndex={p.colorIndex}
                      size="sm"
                      isHost={p.isHost}
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-sm text-[var(--text-primary)] block truncate">
                      {p.name}
                      {isMe && ' (You)'}
                    </span>
                    <span className="text-xs opacity-65 font-bold block">
                      {p.isHost ? 'Host' : copy.targetRoleLabel || 'Suspect'}
                    </span>
                  </div>
                </div>

                {/* Submitted clue next to player's name */}
                <div className="shrink-0 text-right">
                  <span className="text-[11px] opacity-60 block font-bold mb-0.5">
                    {copy.answerLabel || 'Clue:'}
                  </span>
                  <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-black border-2 border-[var(--border-neo)] bg-[var(--surface-card-subtle)] text-[var(--text-primary)]">
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
            className="p-4 rounded-2xl bg-[#86EFAC] text-[#18181B] border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)] flex items-center gap-3"
          >
            <CheckCircle2 className="w-6 h-6 stroke-[3] shrink-0" />
            <div>
              <span className="text-sm font-black block">
                {copy.lockedTitle || 'Vote Locked In!'}
              </span>
              <span className="text-xs font-bold">
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
            className="text-xs font-black opacity-60 hover:opacity-100 cursor-pointer underline underline-offset-4"
          >
            Host: Skip to results immediately
          </button>
        </div>
      )}
    </div>
  );
}
