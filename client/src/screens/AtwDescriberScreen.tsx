import { motion } from 'motion/react';
import { Ban, Mic, BellRing, CheckCircle2 } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerChip } from '../components/PlayerChip';
import { HostBuzzOverride } from '../components/HostBuzzOverride';
import { getPlayerColor } from '@shared/theme/tokens';

interface AtwDescriberScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onEndTurn: () => void;
  onResolveBuzz: (confirm: boolean) => void;
}

/**
 * Avoid the Word — Describer View.
 * Shows the active describer their subject and taboo words while the turn timer runs.
 */
export function AtwDescriberScreen({
  room,
  myPlayer,
  privateState,
  onEndTurn,
  onResolveBuzz,
}: AtwDescriberScreenProps) {
  const atw = room.atwState;
  const playerColor = getPlayerColor(myPlayer.colorIndex);
  const forbidden = privateState.atwForbidden || [];
  const buzzCount = atw?.buzzedPlayerIds.length || 0;
  const requiredBuzzes = atw?.requiredBuzzes || 1;
  const buzzConfirmed = Boolean(atw?.buzzConfirmed);
  const buzzers = (atw?.buzzedPlayerIds || [])
    .map((id) => room.players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Turn header + timer */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black"
            style={{
              backgroundColor: `${playerColor.hex}18`,
              borderColor: playerColor.hex,
              color: 'var(--text-primary)',
            }}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>You're describing!</span>
          </div>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            Turn {atw?.turnNumber || 1} of {atw?.totalTurns || room.players.length}
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Describe Your Subject"
          />
        )}
      </div>

      {/* Subject + trap words */}
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="party-card p-5 rounded-3xl my-auto"
        style={{ boxShadow: `0 10px 26px ${playerColor.hex}1A` }}
      >
        <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400 block text-center mb-1">
          Describe This
        </span>
        <h2 className="text-3xl font-black text-center tracking-tight text-[var(--text-primary)] mb-1">
          {privateState.atwSubject || 'Your subject'}
        </h2>
        {privateState.atwCategory && (
          <span className="text-xs font-bold text-neutral-400 block text-center mb-4">
            {privateState.atwCategory}
          </span>
        )}

        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
          <span className="text-xs font-black uppercase tracking-wider text-red-500 flex items-center justify-center gap-1.5 mb-2">
            <Ban className="w-3.5 h-3.5" />
            <span>Dodge These Trap Words</span>
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {forbidden.map((word) => (
              <span
                key={word}
                className="px-3 py-1.5 rounded-full bg-red-500 text-white text-sm font-black tracking-wide"
              >
                {word}
              </span>
            ))}
          </div>
        </div>

        {/* Live buzz meter */}
        <div className="mt-4 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5" />
              <span>Buzzes Against You</span>
            </span>
            <span
              className={`text-xs font-black ${
                buzzCount > 0 ? 'text-red-500' : 'text-neutral-400'
              }`}
            >
              {buzzCount} / {requiredBuzzes}
            </span>
          </div>

          {buzzers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {buzzers.map((p) => (
                <PlayerChip
                  key={p.id}
                  name={p.name}
                  colorIndex={p.colorIndex}
                  isYou={p.id === myPlayer.id}
                  badge="Buzzed"
                  size="sm"
                />
              ))}
            </div>
          ) : (
            <p className="text-[11px] font-semibold text-neutral-400">
              Clean so far — keep the descriptions coming!
            </p>
          )}
        </div>

        {buzzConfirmed && (
          <div className="mt-3 p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-900/60 text-center">
            <span className="text-xs font-black text-amber-800 dark:text-amber-200">
              Buzz confirmed — the turn is ending as a miss.
            </span>
          </div>
        )}
      </motion.div>

      {/* Host override + end turn + listener roster */}
      <div className="pt-3 space-y-2">
        {myPlayer.isHost && !buzzConfirmed && (
          <HostBuzzOverride
            buzzCount={buzzCount}
            requiredBuzzes={requiredBuzzes}
            onResolveBuzz={onResolveBuzz}
          />
        )}

        <ActionButton
          variant="subtle"
          onClick={onEndTurn}
          icon={<CheckCircle2 className="w-5 h-5" />}
          subtext="Finished early? Hand the mic to the next describer"
        >
          Done Describing
        </ActionButton>

        <div className="pt-1">
          <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block mb-1.5 text-left">
            Listening:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {room.players
              .filter((p) => p.id !== myPlayer.id)
              .map((p) => (
                <PlayerChip
                  key={p.id}
                  name={p.name}
                  colorIndex={p.colorIndex}
                  connected={p.connected}
                  isHost={p.isHost}
                  size="sm"
                  badge={atw?.buzzedPlayerIds.includes(p.id) ? 'Buzzed' : undefined}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
