import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, HeartPulse, Lock, Search, Skull, Users } from 'lucide-react';
import { MafiaRole, Player, PlayerPrivateState, RoomPublicState } from '@shared/types';
import { Timer } from '../../components/Timer';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { MAFIA_ROLE_STYLES, MafiaRoleIcon } from './roleTheme';

interface RoleRevealScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
}

function RoleIcon({ icon, className }: { icon: MafiaRoleIcon; className: string }) {
  if (icon === 'skull') return <Skull className={className} />;
  if (icon === 'search') return <Search className={className} />;
  if (icon === 'heart') return <HeartPulse className={className} />;
  return <Users className={className} />;
}

/**
 * Mafia — Role Reveal.
 * The role sits behind a press-and-hold card so a glance over the shoulder does
 * not leak it. Mafia members also see their family before the first night.
 */
export function RoleRevealScreen({ room, myPlayer, privateState }: RoleRevealScreenProps) {
  const role: MafiaRole = privateState.mafiaRole ?? 'townsperson';
  const style = MAFIA_ROLE_STYLES[role];
  const teammates = privateState.mafiaTeammateNames ?? [];
  const [revealed, setRevealed] = useState(false);

  const startReveal = () => setRevealed(true);
  const endReveal = () => setRevealed(false);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            Round {room.roundNumber} • Mafia
          </span>
          <span className="text-xs font-bold flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Screen private</span>
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

      <div className="my-auto">
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.button
              key="cover"
              type="button"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onPointerDown={startReveal}
              onPointerUp={endReveal}
              onPointerLeave={endReveal}
              onPointerCancel={endReveal}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') startReveal();
              }}
              onKeyUp={endReveal}
              className="w-full party-card p-8 rounded-3xl text-center select-none cursor-pointer touch-none"
              aria-label="Press and hold to reveal your role"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 flex items-center justify-center mb-4">
                <Lock className="w-9 h-9" />
              </div>
              <h2 className="text-2xl font-black text-[var(--text-primary)] mb-1">
                Your role is hidden
              </h2>
              <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-4">
                Press and hold this card to read it. Let go and it hides again.
              </p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-black">
                <Eye className="w-3.5 h-3.5" />
                Hold to reveal
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="role"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 340, damping: 24 }}
              className="p-6 rounded-3xl text-center border shadow-lg select-none"
              style={{
                backgroundColor: style.background,
                borderColor: style.onDark ? `${style.accent}66` : 'var(--border-subtle)',
                color: style.onDark ? '#F2F2F0' : 'var(--text-primary)',
              }}
            >
              <div className="flex justify-center mb-3">
                <PlayerAvatar
                  name={myPlayer.name}
                  colorIndex={myPlayer.colorIndex}
                  size="md"
                  isHost={myPlayer.isHost}
                />
              </div>

              <div
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3"
                style={{
                  backgroundColor: `${style.accent}22`,
                  color: style.accent,
                  boxShadow: `0 0 0 6px ${style.accent}14`,
                }}
              >
                <RoleIcon icon={style.icon} className="w-9 h-9" />
              </div>

              <span
                className="text-[11px] font-black uppercase tracking-widest block mb-1"
                style={{ color: style.onDark ? style.accent : 'var(--text-secondary)' }}
              >
                Your Secret Role
              </span>
              <h2 className="text-3xl font-black tracking-tight mb-1">{style.label}</h2>
              <p
                className="text-sm font-bold mb-4"
                style={{ color: style.onDark ? '#D9D9D9' : 'var(--text-secondary)' }}
              >
                {style.tagline}
              </p>

              {role === 'mafia' && (
                <div
                  className="p-3.5 rounded-2xl mb-4 text-left"
                  style={{ backgroundColor: '#FFFFFF12', border: `1px solid ${style.accent}55` }}
                >
                  <span
                    className="text-[10px] font-black uppercase tracking-wider block mb-1.5"
                    style={{ color: style.accent }}
                  >
                    {teammates.length > 0 ? 'Your family' : 'You work alone'}
                  </span>
                  {teammates.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {teammates.map((name) => (
                        <span
                          key={name}
                          className="px-2.5 py-1 rounded-full text-xs font-black text-white"
                          style={{ backgroundColor: `${style.accent}33` }}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-neutral-300">
                      Nobody else is on your side — stay invisible.
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs leading-relaxed font-medium text-left"
                style={{ color: style.onDark ? '#CFCFCF' : 'var(--text-secondary)' }}
              >
                {privateState.secretInstructions}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-4">
        <p className="text-xs text-center font-semibold text-neutral-500 dark:text-neutral-400">
          Night {room.mafiaState?.nightNumber ? room.mafiaState.nightNumber + 1 : 1} begins when
          the timer ends. Everyone gets the same night screen.
        </p>
      </div>
    </div>
  );
}
