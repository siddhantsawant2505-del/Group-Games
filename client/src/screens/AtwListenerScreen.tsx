import { motion } from 'motion/react';
import { Ear, EyeOff, BellRing, BellOff, AlertTriangle } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerChip } from '../components/PlayerChip';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { HostBuzzOverride } from '../components/HostBuzzOverride';
import { getPlayerColor } from '@shared/theme/tokens';

interface AtwListenerScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onBuzz: () => void;
  onResolveBuzz: (confirm: boolean) => void;
}

/**
 * Avoid the Word — Listener View.
 * The subject stays hidden; the job here is to listen and buzz any taboo slip.
 */
export function AtwListenerScreen({
  room,
  myPlayer,
  onBuzz,
  onResolveBuzz,
}: AtwListenerScreenProps) {
  const atw = room.atwState;
  const describer = room.players.find((p) => p.id === atw?.describerPlayerId);
  const playerColor = getPlayerColor(myPlayer.colorIndex);
  const buzzedPlayerIds = atw?.buzzedPlayerIds || [];
  const buzzCount = buzzedPlayerIds.length;
  const requiredBuzzes = atw?.requiredBuzzes || 1;
  const buzzConfirmed = Boolean(atw?.buzzConfirmed);
  const iBuzzed = buzzedPlayerIds.includes(myPlayer.id);
  const buzzers = buzzedPlayerIds
    .map((id) => room.players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Turn header + timer */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-black text-neutral-600 dark:text-neutral-300">
            <Ear className="w-3.5 h-3.5" />
            <span>You're listening</span>
          </div>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            Turn {atw?.turnNumber || 1} of {atw?.totalTurns || room.players.length}
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Time Left on This Turn"
          />
        )}
      </div>

      {/* Who is describing + hidden subject */}
      <div className="my-auto space-y-3">
        <div className="party-card p-4 rounded-3xl flex items-center gap-3">
          <PlayerAvatar
            name={describer?.name || 'Describer'}
            colorIndex={describer?.colorIndex ?? 0}
            size="lg"
            isHost={describer?.isHost}
          />
          <div className="min-w-0 text-left">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 block">
              Now Describing
            </span>
            <span className="text-lg font-black text-[var(--text-primary)] block truncate">
              {describer?.name || 'Player'}
              {describer?.id === myPlayer.id && ' (You)'}
            </span>
            <span className="text-xs font-semibold text-neutral-400 block">
              Their subject is hidden from you
            </span>
          </div>
          <EyeOff className="w-5 h-5 text-neutral-400 ml-auto shrink-0" />
        </div>

        {/* Buzz button */}
        {buzzConfirmed ? (
          <div className="party-card p-5 rounded-3xl border border-amber-300 dark:border-amber-900/60 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <span className="text-base font-black text-[var(--text-primary)] block">
              Buzz Confirmed!
            </span>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
              {describer?.name || 'The describer'} ends the turn with a miss. Next describer is
              up...
            </p>
          </div>
        ) : (
          <motion.div animate={iBuzzed ? { scale: [1, 1.02, 1] } : {}}>
            <ActionButton
              variant={iBuzzed ? 'subtle' : 'danger'}
              playerColorIndex={myPlayer.colorIndex}
              onClick={onBuzz}
              icon={
                iBuzzed ? (
                  <BellOff className="w-5 h-5" />
                ) : (
                  <BellRing className="w-5 h-5" />
                )
              }
              subtext={
                iBuzzed
                  ? 'Tap again to withdraw your buzz'
                  : 'Heard a taboo word? Flag it instantly'
              }
            >
              {iBuzzed ? 'Buzz Sent — Undo' : 'BUZZ! Taboo Word Said'}
            </ActionButton>
          </motion.div>
        )}

        {/* Buzz progress */}
        <div className="party-card p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
              Group Buzzes
            </span>
            <span
              className={`text-xs font-black ${
                buzzCount >= requiredBuzzes ? 'text-emerald-500' : 'text-neutral-400'
              }`}
            >
              {buzzCount} / {requiredBuzzes} to confirm
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {room.players.map((p) => (
              <PlayerChip
                key={p.id}
                name={p.name}
                colorIndex={p.colorIndex}
                isYou={p.id === myPlayer.id}
                isHost={p.isHost}
                connected={p.connected}
                size="sm"
                badge={
                  p.id === atw?.describerPlayerId
                    ? 'Describing'
                    : buzzedPlayerIds.includes(p.id)
                    ? 'Buzzed'
                    : undefined
                }
              />
            ))}
          </div>

          {buzzers.length > 0 && (
            <span className="text-[11px] font-semibold text-neutral-400 block mt-2">
              Buzzed by {buzzers.map((b) => b.name).join(', ')}
            </span>
          )}
        </div>

        {myPlayer.isHost && (
          <HostBuzzOverride
            buzzCount={buzzCount}
            requiredBuzzes={requiredBuzzes}
            onResolveBuzz={onResolveBuzz}
          />
        )}

        <p
          className="text-xs text-center font-semibold"
          style={{ color: playerColor.hex }}
        >
          {turnHint(myPlayer, buzzCount, requiredBuzzes)}
        </p>
      </div>

      {/* Footer */}
      <div className="pt-3">
        <p className="text-[11px] text-center font-semibold text-neutral-400">
          A strict majority of buzzes (or a host override) ends the turn as a miss.
        </p>
      </div>
    </div>
  );
}

function turnHint(player: Player, buzzCount: number, requiredBuzzes: number): string {
  if (player.isHost) {
    return 'Host: you can confirm or dismiss a buzz below.';
  }
  if (buzzCount === 0) {
    return 'Listen closely — one trap word and you can call it out!';
  }
  return `${requiredBuzzes - buzzCount} more ${
    requiredBuzzes - buzzCount === 1 ? 'buzz' : 'buzzes'
  } to confirm the slip.`;
}
