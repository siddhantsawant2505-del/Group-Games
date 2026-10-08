import { motion } from 'motion/react';
import { Ban, Lock, ArrowRight, Megaphone } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { getPlayerColor } from '@shared/theme/tokens';

interface AtwRevealScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onAdvance: () => void;
}

/**
 * Avoid the Word — Reveal Phase.
 * Each player privately receives their own subject plus 3 forbidden trap words.
 */
export function AtwRevealScreen({
  room,
  myPlayer,
  privateState,
  onAdvance,
}: AtwRevealScreenProps) {
  const isHost = myPlayer.isHost;
  const playerColor = getPlayerColor(myPlayer.colorIndex);
  const forbidden = privateState.atwForbidden || [];
  const turnSeconds = room.atwState?.turnSeconds ?? 45;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Top timer and round indicator */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            Round {room.roundNumber} • {room.selectedGame?.title || 'Avoid the Word'}
          </span>

          <span className="text-xs font-bold flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Keep Screen Hidden</span>
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Reveal Window"
          />
        )}
      </div>

      {/* Secret Subject Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 24 }}
        className="party-card p-6 rounded-3xl text-center shadow-lg my-auto"
        style={{ boxShadow: `0 10px 28px ${playerColor.hex}1F` }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <PlayerAvatar
            name={myPlayer.name}
            colorIndex={myPlayer.colorIndex}
            size="md"
            isHost={myPlayer.isHost}
          />
        </div>

        <div className="flex items-center justify-center mb-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${playerColor.hex}22`, color: playerColor.hex }}
          >
            <Megaphone className="w-8 h-8" />
          </div>
        </div>

        <span className="text-xs font-black uppercase tracking-widest block mb-1 text-neutral-400">
          Your Secret Subject
        </span>

        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-1 text-[var(--text-primary)]">
          {privateState.atwSubject || 'Subject'}
        </h2>

        {privateState.atwCategory && (
          <span className="text-xs font-bold text-neutral-400 block mb-4">
            Category: {privateState.atwCategory}
          </span>
        )}

        {/* Forbidden trap words */}
        <div className="p-4 rounded-2xl mb-4 bg-red-500/10 border border-red-500/30 text-center">
          <span className="text-xs font-black uppercase tracking-wider text-red-500 flex items-center justify-center gap-1.5 mb-2">
            <Ban className="w-3.5 h-3.5" />
            <span>Never Say These 3 Words</span>
          </span>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {forbidden.map((word) => (
              <span
                key={word}
                className="px-3 py-1.5 rounded-full bg-red-500 text-white text-sm font-black tracking-wide shadow-xs"
              >
                {word}
              </span>
            ))}
          </div>
        </div>

        <p className="text-sm leading-relaxed font-medium text-neutral-600 dark:text-neutral-300">
          {privateState.secretInstructions ||
            `When your turn comes you get ${turnSeconds}s to describe your subject out loud.`}
        </p>
      </motion.div>

      {/* Turn flow note + host advance */}
      <div className="pt-4 space-y-2">
        <p className="text-xs text-center font-semibold text-neutral-500 dark:text-neutral-400">
          Turns rotate one player at a time — {turnSeconds}s each, and everyone else can buzz a
          taboo slip.
        </p>

        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Ready? Skip waiting for the timer"
          >
            Start Describing Turns
          </ActionButton>
        ) : (
          <p className="text-xs text-center font-semibold text-neutral-400">
            Auto-advancing when the timer expires...
          </p>
        )}
      </div>
    </div>
  );
}
