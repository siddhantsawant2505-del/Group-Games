import { motion } from 'motion/react';
import { Hash, Lock, ArrowRight, HelpCircle, Sparkles } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { SpectrumBar } from '../components/SpectrumBar';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { getPlayerColor } from '@shared/theme/tokens';

interface Top100RevealScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onAdvance: () => void;
}

/**
 * Top 100 — Number Reveal.
 * Each player privately sees their own unique secret number plus the spectrum
 * they are placing it on. Nobody sees anyone else's number.
 */
export function Top100RevealScreen({
  room,
  myPlayer,
  privateState,
  onAdvance,
}: Top100RevealScreenProps) {
  const isHost = myPlayer.isHost;
  const playerColor = getPlayerColor(myPlayer.colorIndex);
  const top100 = room.top100State;
  const myNumber = privateState.top100Number ?? 0;

  const lowLabel = privateState.top100LowLabel || top100?.lowLabel || 'low';
  const highLabel = privateState.top100HighLabel || top100?.highLabel || 'high';

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            Round {room.roundNumber} • {room.selectedGame?.title || 'Top 100'}
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

      {/* Private number card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 24 }}
        className="party-card p-6 rounded-3xl text-center shadow-lg my-auto"
        style={{ boxShadow: `0 10px 28px ${playerColor.hex}1F` }}
      >
        <div className="flex items-center justify-center mb-3">
          <PlayerAvatar
            name={myPlayer.name}
            colorIndex={myPlayer.colorIndex}
            size="md"
            isHost={myPlayer.isHost}
          />
        </div>

        <span className="text-xs font-black uppercase tracking-widest block mb-1 text-neutral-400">
          Your Secret Number
        </span>

        <div className="flex items-center justify-center gap-1 mb-1">
          <Hash className="w-6 h-6 text-neutral-300 dark:text-neutral-600" />
          <span
            className="text-6xl font-black leading-none tracking-tight"
            style={{ color: playerColor.hex }}
          >
            {myNumber || '—'}
          </span>
        </div>

        <span className="text-xs font-bold block mb-4 text-neutral-500 dark:text-neutral-400">
          out of 100 · unique to you this round
        </span>

        {/* The spectrum this number lives on */}
        <div
          className="p-3 rounded-2xl mb-3 text-left"
          style={{ backgroundColor: `${playerColor.hex}12` }}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-2">
            The Spectrum
          </span>
          <SpectrumBar
            lowLabel={lowLabel}
            highLabel={highLabel}
            markers={[{ value: myNumber || 1, colorHex: playerColor.hex }]}
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
          {(privateState.top100Category || top100?.category) && (
            <span
              className="px-2.5 py-1 rounded-xl text-[11px] font-black border"
              style={{
                backgroundColor: `${playerColor.hex}18`,
                borderColor: `${playerColor.hex}50`,
                color: 'var(--text-primary)',
              }}
            >
              {privateState.top100Category || top100?.category}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
            {room.players.length} examples coming
          </span>
        </div>

        <p className="text-sm leading-relaxed font-medium text-neutral-500 dark:text-neutral-400">
          {privateState.secretInstructions ||
            `Write an example that fits ${myNumber} on this scale.`}
        </p>
      </motion.div>

      {/* Host advance */}
      <div className="pt-4 space-y-2">
        <p className="text-xs text-center font-semibold text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Next: everyone writes one short example for their own number.</span>
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
          <div className="party-card p-4 rounded-2xl text-center flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Waiting for the host to open the writing phase...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
