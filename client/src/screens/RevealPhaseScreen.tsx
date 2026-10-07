import { motion } from 'motion/react';
import { ShieldAlert, Eye, Lock, ArrowRight } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { THEME_COLORS } from '@shared/theme/tokens';

interface RevealPhaseScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onAdvance: () => void;
}

export function RevealPhaseScreen({
  room,
  myPlayer,
  privateState,
  onAdvance,
}: RevealPhaseScreenProps) {
  const isSpecialRole = Boolean(privateState.isSpecialRole);
  const isHost = myPlayer.isHost;

  // Use deep charcoal-purple #3D2C4E accent strictly on the impostor/special-role screen
  const specialBg = THEME_COLORS.semantic.specialRoleAccent;

  return (
    <div
      className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full transition-colors"
      style={{
        backgroundColor: isSpecialRole ? specialBg : undefined,
        color: isSpecialRole ? '#F2F2F0' : undefined,
      }}
    >
      {/* Top Timer and round indicator */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${
              isSpecialRole
                ? 'bg-white/10 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            Round {room.roundNumber} • {room.selectedGame?.title || 'Party Game'}
          </span>

          <span
            className={`text-xs font-bold flex items-center gap-1 ${
              isSpecialRole ? 'text-amber-300' : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
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

      {/* Main Secret Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 24 }}
        className={`p-6 rounded-3xl text-center shadow-lg my-auto border ${
          isSpecialRole
            ? 'bg-white/10 border-white/20 text-white backdrop-blur-xs'
            : 'party-card'
        }`}
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
          {isSpecialRole ? (
            <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Eye className="w-8 h-8" />
            </div>
          )}
        </div>

        <span
          className={`text-xs font-black uppercase tracking-widest block mb-1 ${
            isSpecialRole ? 'text-red-300' : 'text-neutral-400'
          }`}
        >
          Your Secret Assignment
        </span>

        <h2
          className={`text-2xl sm:text-3xl font-black tracking-tight mb-3 ${
            isSpecialRole ? 'text-red-400' : 'text-[var(--text-primary)]'
          }`}
        >
          {isSpecialRole ? "You're the Impostor" : (privateState.role || 'Crew Member')}
        </h2>

        {/* Secret Word Box or Impostor Bluff Guide */}
        {isSpecialRole ? (
          <div className="p-4 rounded-2xl mb-4 bg-red-950/40 border border-red-500/30 text-center">
            <span className="text-xs font-black uppercase tracking-wider text-red-300 block mb-1">
              Mission Objective
            </span>
            <span className="text-lg font-black text-white block">
              You do NOT know the secret word
            </span>
            <p className="text-xs text-neutral-300 font-medium mt-1.5">
              Listen closely to others' clues, fake your knowledge with a plausible one-word clue, and avoid getting convicted!
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl mb-4 bg-neutral-100 dark:bg-neutral-800/80 border border-[var(--border-subtle)]">
            <span className="text-xs font-bold block mb-1 text-neutral-500 dark:text-neutral-400">
              The word is:
            </span>
            <span className="text-3xl font-black tracking-wide text-[var(--text-primary)]">
              {privateState.secretWord}
            </span>
            {privateState.secretHint && (
              <span className="text-xs font-semibold text-neutral-400 block mt-1">
                {privateState.secretHint}
              </span>
            )}
          </div>
        )}

        <p
          className={`text-sm leading-relaxed font-medium ${
            isSpecialRole ? 'text-neutral-200' : 'text-neutral-600 dark:text-neutral-300'
          }`}
        >
          {privateState.secretInstructions ||
            privateState.secretHint ||
            'Review your role and prepare for the round.'}
        </p>
      </motion.div>

      {/* Host Skip / Advance or Status */}
      <div className="pt-4">
        {isHost ? (
          <ActionButton
            variant={isSpecialRole ? 'subtle' : 'shared'}
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Ready? Skip waiting for timer"
          >
            Proceed to Input Phase
          </ActionButton>
        ) : (
          <p
            className={`text-xs text-center font-semibold ${
              isSpecialRole ? 'text-neutral-300' : 'text-neutral-400'
            }`}
          >
            Auto-advancing when timer expires...
          </p>
        )}
      </div>
    </div>
  );
}
