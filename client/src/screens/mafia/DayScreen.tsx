import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronDown,
  Eye,
  MessageSquare,
  ScrollText,
  Skull,
  Users,
  Vote,
} from 'lucide-react';
import {
  MAFIA_ROLE_LABELS,
  MafiaRole,
  Player,
  PlayerPrivateState,
  RoomPublicState,
} from '@shared/types';
import { Timer } from '../../components/Timer';
import { ActionButton } from '../../components/ActionButton';
import { PlayerAvatar } from '../../components/PlayerAvatar';

interface DayScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onReadyToVote: () => void;
  onHostAdvance: () => void;
}

/**
 * Mafia — Day.
 * The app only runs the timer; the talking happens out loud. The public log keeps
 * every past night and exile visible, and the Detective can reopen their own notes.
 */
export function DayScreen({
  room,
  myPlayer,
  privateState,
  onReadyToVote,
  onHostAdvance,
}: DayScreenProps) {
  const state = room.mafiaState;
  const alive = state?.alivePlayerIds ?? room.players.map((player) => player.id);
  const isAlive = privateState.mafiaIsAlive !== false;
  const readyIds = state?.readyToVoteIds ?? [];
  const readyCount = readyIds.filter((id) => alive.includes(id)).length;
  const isReady = Boolean(privateState.mafiaReadyToVote);
  const [showNotes, setShowNotes] = useState(false);
  const investigations = privateState.mafiaInvestigations ?? [];

  const deaths = state?.deaths ?? [];

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Day {state?.dayNumber ?? 1}</span>
          </span>
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>
              {alive.length} alive · {room.players.length - alive.length} out
            </span>
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Discussion Timer"
          />
        )}

        <p className="text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {readyCount} of {alive.length} ready to vote · more than half starts the ballot
        </p>
      </div>

      <div className="my-auto space-y-3">
        {/* The village, with its dead */}
        <div className="party-card p-4 rounded-3xl">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-2">
            The village
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {room.players.map((player) => {
              const isOut = !alive.includes(player.id);
              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-2 p-2 rounded-xl border ${
                    isOut
                      ? 'opacity-45 border-transparent'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-card-subtle)]'
                  }`}
                >
                  <PlayerAvatar
                    name={player.name}
                    colorIndex={player.colorIndex}
                    size="xs"
                    isHost={player.isHost}
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-black text-[var(--text-primary)] truncate">
                      {player.name}
                      {player.id === myPlayer.id && ' (You)'}
                    </span>
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                      {isOut ? 'Out' : readyIds.includes(player.id) ? 'Ready' : 'Alive'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Public log: every resolved night and exile */}
        {deaths.length > 0 && (
          <div className="party-card p-4 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
              <ScrollText className="w-3.5 h-3.5" />
              <span>What the village knows</span>
            </span>
            <div className="space-y-1">
              {deaths.map((death) => (
                <div
                  key={`${death.playerId}-${death.cause}-${death.night}`}
                  className="flex items-start gap-1.5 text-[11px] font-semibold"
                >
                  {death.cause === 'night-kill' ? (
                    <Skull className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                  ) : (
                    <Vote className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <span className="text-neutral-500 dark:text-neutral-400">
                    <strong className="text-[var(--text-primary)]">{death.playerName}</strong>{' '}
                    {death.cause === 'night-kill'
                      ? `was killed on night ${death.night}`
                      : `was exiled on day ${death.day ?? death.night}`}
                    {death.role ? ` — ${MAFIA_ROLE_LABELS[death.role as MafiaRole]}` : ''}.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detective's private notes */}
        {privateState.mafiaRole === 'detective' && isAlive && (
          <div className="party-card p-4 rounded-2xl">
            <button
              type="button"
              onClick={() => setShowNotes((previous) => !previous)}
              className="w-full flex items-center justify-between gap-2 cursor-pointer"
              aria-expanded={showNotes}
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>Your notes ({investigations.length})</span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-neutral-400 transition-transform ${
                  showNotes ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showNotes && (
              <div className="mt-2 space-y-1">
                {investigations.length === 0 ? (
                  <p className="text-[11px] font-semibold text-neutral-400">
                    No investigations yet.
                  </p>
                ) : (
                  investigations.map((finding) => (
                    <div
                      key={`${finding.night}-${finding.targetName}`}
                      className="flex items-center justify-between text-[11px] font-bold"
                    >
                      <span className="text-neutral-500 dark:text-neutral-400">
                        Night {finding.night}: {finding.targetName}
                      </span>
                      <span style={{ color: finding.isMafia ? '#EF4444' : '#22C55E' }}>
                        {finding.isMafia ? 'Mafia' : 'Not Mafia'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 space-y-2">
        {isAlive ? (
          <ActionButton
            variant={isReady ? 'subtle' : 'shared'}
            onClick={onReadyToVote}
            disabled={isReady}
            icon={<Vote className="w-5 h-5" />}
            subtext={
              isReady
                ? 'Waiting for more of the village to agree'
                : 'End the discussion early once more than half agree'
            }
          >
            {isReady ? 'You Are Ready' : 'Ready to Vote'}
          </ActionButton>
        ) : (
          <p className="text-xs text-center font-semibold text-neutral-400">
            The dead do not vote. Watch the village decide.
          </p>
        )}

        {myPlayer.isHost && (
          <button
            type="button"
            onClick={onHostAdvance}
            className="w-full text-[11px] font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
          >
            Host: start voting now
          </button>
        )}
      </div>
    </div>
  );
}
