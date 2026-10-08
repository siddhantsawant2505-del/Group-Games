import { motion } from 'motion/react';
import { Link2, Lock, ArrowRight, HelpCircle, Layers } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { getPlayerColor } from '@shared/theme/tokens';

interface GtlHintRevealScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onAdvance: () => void;
}

/**
 * Guess the Link — Hint Reveal.
 * Each player privately sees their own single angle on a shared hidden concept
 * (plus a category nudge). Nobody sees the concept or anyone else's hint.
 */
export function GtlHintRevealScreen({
  room,
  myPlayer,
  privateState,
  onAdvance,
}: GtlHintRevealScreenProps) {
  const isHost = myPlayer.isHost;
  const playerColor = getPlayerColor(myPlayer.colorIndex);
  const gtl = room.gtlState;
  const hint = privateState.gtlHint || 'Your angle';

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            Round {room.roundNumber} • {room.selectedGame?.title || 'Guess the Link'}
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

      {/* Private hint card */}
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
            <Link2 className="w-8 h-8" />
          </div>
        </div>

        <span className="text-xs font-black uppercase tracking-widest block mb-1 text-neutral-400">
          Your Private Angle
        </span>

        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
          {hint}
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
          {privateState.gtlCategory && (
            <span
              className="px-2.5 py-1 rounded-xl text-[11px] font-black border"
              style={{
                backgroundColor: `${playerColor.hex}18`,
                borderColor: `${playerColor.hex}50`,
                color: 'var(--text-primary)',
              }}
            >
              {privateState.gtlCategory}
            </span>
          )}

          {privateState.gtlHintIndex && privateState.gtlHintCount && (
            <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>
                Angle {privateState.gtlHintIndex} of {privateState.gtlHintCount}
              </span>
            </span>
          )}
        </div>

        <div
          className="p-3 rounded-2xl text-xs font-semibold leading-relaxed"
          style={{
            backgroundColor: `${playerColor.hex}12`,
            color: 'var(--text-secondary)',
          }}
        >
          <span className="block">
            Every player at the table got a <strong>different angle</strong> on the same hidden
            concept.
          </span>
          <span className="block mt-1 opacity-80">
            {gtl?.conceptWordCount
              ? `The concept is ${gtl.conceptWordCount} ${gtl.conceptWordCount === 1 ? 'word' : 'words'} long.`
              : 'The concept is hidden until the end.'}
          </span>
        </div>

        <p className="text-sm leading-relaxed font-medium mt-3 text-neutral-500 dark:text-neutral-400">
          {privateState.secretInstructions || 'Write a response that fits your angle.'}
        </p>
      </motion.div>

      {/* Host advance */}
      <div className="pt-4 space-y-2">
        <p className="text-xs text-center font-semibold text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Next: everyone writes one short response from their own angle.</span>
        </p>

        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Ready? Skip the timer when everyone has looked"
          >
            Start Writing
          </ActionButton>
        ) : (
          <p className="text-xs text-center font-semibold text-neutral-400">
            Waiting for the host to start the response phase...
          </p>
        )}
      </div>
    </div>
  );
}
