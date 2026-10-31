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

  const specialBg = THEME_COLORS.semantic.specialRoleAccent;

  return (
    <div
      className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full transition-colors"
      style={{
        backgroundColor: isSpecialRole ? specialBg : undefined,
        color: isSpecialRole ? '#FAF8F5' : undefined,
      }}
    >
      {/* Top Timer and round indicator */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-xl border-2 ${
              isSpecialRole
                ? 'bg-white/10 text-white border-white/30 shadow-[2px_2px_0px_#FFFFFF]'
                : 'bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)]'
            }`}
          >
            Round {room.roundNumber} • {room.selectedGame?.title || 'Party Game'}
          </span>

          <span
            className={`text-xs font-black flex items-center gap-1 ${
              isSpecialRole ? 'text-amber-300' : 'opacity-70'
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
        className={`p-6 rounded-3xl text-center my-auto border-[2.5px] ${
          isSpecialRole
            ? 'bg-[#18181B] border-[#FDA4AF] shadow-[6px_6px_0px_#FDA4AF] text-white'
            : 'bg-[var(--surface-card)] border-[var(--border-neo)] shadow-[6px_6px_0px_var(--border-neo)]'
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
            <div className="w-14 h-14 rounded-2xl bg-[#FDA4AF] text-[#18181B] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] flex items-center justify-center pulse-timer">
              <ShieldAlert className="w-8 h-8 stroke-[2.5]" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#86EFAC] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-center">
              <Eye className="w-8 h-8 stroke-[2.5]" />
            </div>
          )}
        </div>

        <span
          className={`text-xs font-black uppercase tracking-widest block mb-1 ${
            isSpecialRole ? 'text-[#FDA4AF]' : 'opacity-60'
          }`}
        >
          Your Secret Assignment
        </span>

        <h2
          className={`text-2xl sm:text-3xl font-black tracking-tight mb-3 ${
            isSpecialRole ? 'text-[#FDA4AF]' : 'text-[var(--text-primary)]'
          }`}
        >
          {isSpecialRole ? "You're the Impostor!" : (privateState.role || 'Crew Member')}
        </h2>

        {/* Secret Word Box or Impostor Bluff Guide */}
        {isSpecialRole ? (
          <div className="p-4 rounded-2xl mb-4 bg-red-950/60 border-2 border-[#FDA4AF] shadow-[3px_3px_0px_#FDA4AF] text-center">
            <span className="text-xs font-black uppercase tracking-wider text-[#FDA4AF] block mb-1">
              Mission Objective
            </span>
            <span className="text-lg font-black text-white block">
              You do NOT know the secret word
            </span>
            <p className="text-xs text-neutral-300 font-bold mt-1.5 leading-relaxed">
              Listen closely to others' clues, fake your knowledge with a plausible one-word clue, and avoid getting convicted!
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl mb-4 bg-[#FEF08A] border-2 border-[var(--border-neo)] shadow-[3px_3px_0px_var(--border-neo)] text-[#18181B]">
            <span className="text-xs font-bold block mb-1 opacity-75">
              The secret word is:
            </span>
            <span className="text-3xl font-black tracking-wide block">
              {privateState.secretWord}
            </span>
            {privateState.secretHint && (
              <span className="text-xs font-bold opacity-75 block mt-1">
                Hint: {privateState.secretHint}
              </span>
            )}
          </div>
        )}

        <p
          className={`text-sm leading-relaxed font-semibold ${
            isSpecialRole ? 'text-neutral-200' : 'opacity-75'
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
            className={`text-xs text-center font-bold ${
              isSpecialRole ? 'text-neutral-300' : 'opacity-60'
            }`}
          >
            Auto-advancing when timer expires...
          </p>
        )}
      </div>
    </div>
  );
}
