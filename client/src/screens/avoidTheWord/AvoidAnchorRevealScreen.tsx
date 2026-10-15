import { motion } from 'motion/react';
import { ArrowRight, Crown, EyeOff, Hourglass, Lightbulb } from 'lucide-react';
import { Player, PlayerPrivateState, RoomPublicState } from '@shared/types';
import { ActionButton } from '../../components/ActionButton';
import { Timer } from '../../components/Timer';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { getPlayerColor } from '@shared/theme/tokens';
import { AvoidStatusStrip } from './AvoidStatusStrip';

interface AvoidAnchorRevealScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  /** Host moves the room on to the anchor's answer window early. */
  onAdvance: () => void;
}

/**
 * Avoid the Word — Anchor Briefing (the round's reveal phase).
 * The anchor privately reads the question; everybody else only learns who is
 * holding the question. The server keeps the question out of every other payload.
 */
export function AvoidAnchorRevealScreen({
  room,
  myPlayer,
  privateState,
  onAdvance,
}: AvoidAnchorRevealScreenProps) {
  const avoid = room.avoidState;
  const isAnchor = Boolean(privateState.avoidIsAnchor);
  const question = privateState.avoidQuestion;
  const playerColor = getPlayerColor(myPlayer.colorIndex);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            Round {avoid?.roundNumber ?? room.roundNumber} of {avoid?.roundCap ?? 10}
          </span>

          {isAnchor ? (
            <span className="text-xs font-bold flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <EyeOff className="w-3.5 h-3.5" />
              <span>Keep your screen hidden</span>
            </span>
          ) : (
            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              {avoid?.aliveCount ?? room.players.length} still alive
            </span>
          )}
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label={isAnchor ? 'Read your question' : 'Anchor is reading'}
          />
        )}
      </div>

      {isAnchor && question ? (
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 24 }}
          className="party-card p-6 rounded-3xl my-auto text-center"
          style={{ boxShadow: `0 10px 28px ${playerColor.hex}1F` }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.16)', color: '#B45309' }}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>You are the Anchor</span>
            </span>
          </div>

          <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400 block mb-1">
            Your question
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)] leading-tight mb-2">
            {question}
          </h2>
          {privateState.avoidQuestionCategory && (
            <span className="text-xs font-bold text-neutral-400 block mb-4">
              {privateState.avoidQuestionCategory}
            </span>
          )}

          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-left">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-relaxed">
              Others must avoid matching your answer. Pick what the group is likely to say — every
              player who matches you is knocked out, and you score a point for each of them.
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="my-auto text-center">
          <div className="flex items-center justify-center mb-3">
            <PlayerAvatar
              name={avoid?.anchorPlayerName || 'Anchor'}
              colorIndex={
                room.players.find((player) => player.id === avoid?.anchorPlayerId)?.colorIndex ?? 0
              }
              size="md"
            />
          </div>

          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black mb-3"
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.16)', color: '#B45309' }}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>This round&apos;s Anchor</span>
          </span>

          <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)] leading-tight mb-2">
            {avoid?.anchorPlayerName || 'The anchor'} is holding the question
          </h2>

          <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 leading-relaxed flex items-center justify-center gap-1.5">
            <Hourglass className="w-4 h-4" />
            <span>You&apos;ll answer it on your turn — nobody sees their answer.</span>
          </p>
        </div>
      )}

      <div className="pt-4 space-y-3">
        {avoid && (
          <div className="party-card p-3 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-2 text-left">
              Table
            </span>
            <AvoidStatusStrip
              statuses={avoid.statuses}
              anchorPlayerId={avoid.anchorPlayerId}
              myPlayerId={myPlayer.id}
            />
          </div>
        )}

        {isAnchor && myPlayer.isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Skip the read window and answer now"
          >
            Answer Now
          </ActionButton>
        ) : (
          <p className="text-xs text-center font-semibold text-neutral-400">
            {myPlayer.isHost
              ? 'Auto-advancing when the timer expires...'
              : `${avoid?.anchorPlayerName || 'The anchor'} answers first, then turns open.`}
          </p>
        )}
      </div>
    </div>
  );
}
