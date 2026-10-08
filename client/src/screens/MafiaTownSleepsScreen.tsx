import { motion } from 'motion/react';
import { Moon, Ghost, MoonStar } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerChip } from '../components/PlayerChip';

interface MafiaTownSleepsScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onHostResolveNight: () => void;
}

/**
 * Mafia — Town Sleeps.
 * The waiting screen for everyone without a night action (townspeople and the
 * eliminated), styled as a quiet, dark night.
 */
export function MafiaTownSleepsScreen({
  room,
  myPlayer,
  onHostResolveNight,
}: MafiaTownSleepsScreenProps) {
  const mafiaState = room.mafiaState;
  const graveyard = room.players.filter((p) =>
    (mafiaState?.eliminatedIds || []).includes(p.id)
  );
  const lastExiledName = mafiaState?.lastExiledName;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Night header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
            <MoonStar className="w-3.5 h-3.5" />
            <span>Night {mafiaState?.nightNumber || 1}</span>
          </span>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            Eyes closed
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Until Sunrise"
          />
        )}
      </div>

      {/* Sleep card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-7 rounded-3xl text-center my-auto border"
        style={{ backgroundColor: '#14152A', borderColor: 'rgba(140,150,255,0.35)', color: '#F2F2F0' }}
      >
        <motion.div
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
          className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(140,150,255,0.16)', color: '#A5B4FC' }}
        >
          <Moon className="w-11 h-11" />
        </motion.div>

        <h2 className="text-2xl font-black mb-2">The Town Sleeps…</h2>
        <p className="text-sm font-semibold text-neutral-300 leading-relaxed">
          Mafia and the Detective are making their moves. Keep your phone face down and your eyes
          closed — no talking until sunrise.
        </p>

        <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-neutral-200">
          <span className="block">
            {mafiaState?.pendingNightActions || 0} night{' '}
            {(mafiaState?.pendingNightActions || 0) === 1 ? 'action is' : 'actions are'} still in
            play
          </span>
          {lastExiledName && (
            <span className="block mt-1 opacity-80">
              Yesterday the town exiled {lastExiledName}.
            </span>
          )}
        </div>
      </motion.div>

      {/* Graveyard */}
      <div className="pt-3 space-y-2">
        <div className="party-card p-4 rounded-2xl">
          <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
            <Ghost className="w-3.5 h-3.5" />
            <span>Out of the Game ({graveyard.length})</span>
          </span>

          {graveyard.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {graveyard.map((p) => (
                <PlayerChip
                  key={p.id}
                  name={p.name}
                  colorIndex={p.colorIndex}
                  isYou={p.id === myPlayer.id}
                  size="sm"
                  badge="Out"
                />
              ))}
            </div>
          ) : (
            <p className="text-xs font-semibold text-neutral-400">
              Everyone is still alive — for now.
            </p>
          )}
        </div>

        {myPlayer.isHost ? (
          <ActionButton
            variant="subtle"
            onClick={onHostResolveNight}
            icon={<Moon className="w-4 h-4" />}
            subtext="Skip the remaining night wait"
          >
            Resolve Night Now
          </ActionButton>
        ) : (
          <p className="text-xs text-center font-semibold text-neutral-400">
            Waiting for sunrise...
          </p>
        )}
      </div>
    </div>
  );
}
