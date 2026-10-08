import { motion } from 'motion/react';
import { Sunrise, Ghost, ArrowRight, Skull, HeartPulse } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PlayerChip } from '../components/PlayerChip';

interface MafiaMorningScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onAdvance: () => void;
}

/**
 * Mafia — Morning Report.
 * Reveals who the Mafia eliminated overnight (never who voted for them).
 */
export function MafiaMorningScreen({ room, myPlayer, onAdvance }: MafiaMorningScreenProps) {
  const mafiaState = room.mafiaState;
  const victimName = mafiaState?.lastNightVictimName || null;
  const victim = room.players.find((p) => p.id === mafiaState?.lastNightVictimId);
  const graveyard = room.players.filter((p) =>
    (mafiaState?.eliminatedIds || []).includes(p.id)
  );
  const peaceful = !victimName;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Morning header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
            <Sunrise className="w-3.5 h-3.5" />
            <span>Day {mafiaState?.dayNumber || 1} • Morning Report</span>
          </span>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            {mafiaState?.alivePlayerIds.length || room.players.length} alive
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Gathering the Town"
          />
        )}
      </div>

      {/* Elimination reveal */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-3xl text-center my-auto border"
        style={{
          backgroundColor: peaceful ? 'var(--surface-card)' : '#2B1113',
          borderColor: peaceful ? 'var(--border-subtle)' : 'rgba(239,68,68,0.45)',
          color: peaceful ? 'var(--text-primary)' : '#F2F2F0',
        }}
      >
        <div className="flex items-center justify-center mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: peaceful ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.18)',
              color: peaceful ? '#22C55E' : '#EF4444',
            }}
          >
            {peaceful ? <HeartPulse className="w-9 h-9" /> : <Skull className="w-9 h-9" />}
          </div>
        </div>

        <span
          className="text-[11px] font-black uppercase tracking-widest block mb-2"
          style={{ color: peaceful ? 'var(--text-secondary)' : '#EF4444' }}
        >
          Night {mafiaState?.nightNumber || 1} Result
        </span>

        {peaceful ? (
          <>
            <h2 className="text-2xl font-black mb-2">A Peaceful Night</h2>
            <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
              Nobody was eliminated overnight. The Mafia struck no one.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-3">
              <PlayerAvatar
                name={victimName || 'Player'}
                colorIndex={victim?.colorIndex ?? 0}
                size="lg"
              />
            </div>
            <h2 className="text-2xl font-black mb-2">{victimName} was eliminated</h2>
            <p className="text-sm font-semibold text-neutral-300 leading-relaxed">
              The Mafia took them overnight. Nobody saw who did it — but somebody in this room
              did.
            </p>
          </>
        )}
      </motion.div>

      {/* Graveyard + advance */}
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
            <p className="text-xs font-semibold text-neutral-400">Nobody has been eliminated.</p>
          )}
        </div>

        {myPlayer.isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Open the floor so the town can accuse and vote"
          >
            Gather the Town
          </ActionButton>
        ) : (
          <p className="text-xs text-center font-semibold text-neutral-400">
            Auto-advancing to the town discussion...
          </p>
        )}
      </div>
    </div>
  );
}
