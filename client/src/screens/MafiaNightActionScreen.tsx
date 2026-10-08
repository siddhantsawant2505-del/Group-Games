import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Moon, Skull, Search, Crosshair, CheckCircle2, Eye, Users } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerChip } from '../components/PlayerChip';

interface MafiaNightActionScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onSelectTarget: (targetPlayerId: string) => void;
  onHostResolveNight: () => void;
}

/**
 * Mafia — Night Action.
 * Only reachable by living Mafia members and the Detective. Everyone else
 * sees the town-sleeps waiting screen instead.
 */
export function MafiaNightActionScreen({
  room,
  myPlayer,
  privateState,
  onSelectTarget,
  onHostResolveNight,
}: MafiaNightActionScreenProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const isMafia = privateState.mafiaRole === 'mafia';
  const isDetective = privateState.mafiaRole === 'detective';
  const accent = isMafia ? '#EF4444' : '#6366F1';
  const mafiaState = room.mafiaState;
  const alivePlayerIds = mafiaState?.alivePlayerIds || room.players.map((p) => p.id);
  const teammateIds = privateState.mafiaTeammateIds || [];
  const submitted = Boolean(privateState.mafiaActionSubmitted);
  const investigations = privateState.mafiaInvestigations || [];
  const latestFinding = investigations.length > 0 ? investigations[investigations.length - 1] : null;

  // Reset the local pick whenever a new night starts.
  useEffect(() => {
    setSelectedTargetId(null);
  }, [mafiaState?.nightNumber]);

  // Living players are the only valid targets; the Mafia never targets its own family.
  const targetList = room.players.filter(
    (p) =>
      alivePlayerIds.includes(p.id) &&
      p.id !== myPlayer.id &&
      !(isMafia && teammateIds.includes(p.id))
  );

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Night header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black"
            style={{ backgroundColor: `${accent}1F`, color: '#FFFFFF', border: `1px solid ${accent}` }}
          >
            {isMafia ? <Skull className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
            <span>{isMafia ? 'Mafia Night Action' : 'Detective Investigation'}</span>
          </div>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            <Moon className="w-3.5 h-3.5" />
            <span>Night {mafiaState?.nightNumber || 1}</span>
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Time Until Sunrise"
          />
        )}
      </div>

      {/* Action card */}
      <div className="my-auto space-y-3">
        <div
          className="p-5 rounded-3xl border"
          style={{ backgroundColor: '#14152A', borderColor: `${accent}55`, color: '#F2F2F0' }}
        >
          <span className="text-[11px] font-black uppercase tracking-widest block mb-1" style={{ color: accent }}>
            {isMafia ? 'Tonight’s Victim' : 'Tonight’s Investigation'}
          </span>
          <h2 className="text-xl font-black leading-tight mb-3">
            {isMafia
              ? 'Pick one player to eliminate while the town sleeps.'
              : 'Pick one player to learn whether they are Mafia.'}
          </h2>

          {submitted ? (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5" style={{ color: accent }} />
                <span className="text-sm font-black">Locked In</span>
              </div>
              <span className="text-xs font-semibold text-neutral-300">
                {isMafia
                  ? `Your target: ${privateState.mafiaActionTargetName || 'chosen'}.`
                  : `You investigated ${privateState.mafiaActionTargetName || 'a player'}.`}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {targetList.map((p) => (
                <PlayerChip
                  key={p.id}
                  name={p.name}
                  colorIndex={p.colorIndex}
                  isYou={p.id === myPlayer.id}
                  size="md"
                  selectable
                  selected={selectedTargetId === p.id}
                  onClick={() => setSelectedTargetId(p.id)}
                />
              ))}
            </div>
          )}

          {!submitted && (
            <div className="mt-4">
              <ActionButton
                variant="personal"
                playerColorIndex={myPlayer.colorIndex}
                disabled={!selectedTargetId}
                onClick={() => selectedTargetId && onSelectTarget(selectedTargetId)}
                icon={isMafia ? <Crosshair className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                subtext="Held privately until the morning report"
              >
                {isMafia ? 'Confirm Victim' : 'Confirm Investigation'}
              </ActionButton>
            </div>
          )}

          {targetList.length === 0 && !submitted && (
            <p className="text-xs font-semibold text-neutral-400 mt-3">
              No valid targets are available tonight.
            </p>
          )}
        </div>

        {/* Detective private findings */}
        {isDetective && (
          <div className="party-card p-4 rounded-2xl">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
              <Eye className="w-3.5 h-3.5" />
              <span>Your Case File</span>
            </span>

            {latestFinding ? (
              <div
                className="p-3 rounded-xl mb-2"
                style={{
                  backgroundColor: latestFinding.isMafia ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                  border: `1px solid ${latestFinding.isMafia ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}`,
                }}
              >
                <span className="text-sm font-black block">
                  {latestFinding.targetName} {latestFinding.isMafia ? 'IS the Mafia!' : 'is not the Mafia.'}
                </span>
                <span className="text-[11px] font-semibold text-neutral-400">
                  Found on night {latestFinding.night}
                </span>
              </div>
            ) : (
              <p className="text-xs font-semibold text-neutral-400">
                No findings yet — your first investigation is tonight.
              </p>
            )}

            {investigations.length > 1 && (
              <div className="pt-2 border-t border-[var(--border-subtle)] mt-1 space-y-1">
                {investigations.slice(0, -1).map((finding) => (
                  <div key={`${finding.night}-${finding.targetName}`} className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Night {finding.night}: {finding.targetName}
                    </span>
                    <span style={{ color: finding.isMafia ? '#EF4444' : '#22C55E' }}>
                      {finding.isMafia ? 'Mafia' : 'Not Mafia'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mafia team coordination */}
        {isMafia && (privateState.mafiaTeamSelections || []).length > 0 && (
          <div className="party-card p-4 rounded-2xl">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5" />
              <span>Family Coordination</span>
            </span>

            <div className="space-y-1.5">
              {(privateState.mafiaTeamSelections || []).map((selection) => (
                <div
                  key={selection.playerName}
                  className="flex items-center justify-between text-xs font-bold"
                >
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {selection.playerName}
                    {selection.playerName === myPlayer.name && ' (You)'}
                  </span>
                  <span className="text-[var(--text-primary)]">
                    {selection.playerName === myPlayer.name
                      ? submitted
                        ? privateState.mafiaActionTargetName || 'chosen'
                        : 'choosing...'
                      : selection.targetName || 'choosing...'}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] font-semibold text-neutral-400 mt-2">
              A majority of your votes decides tonight’s victim.
            </p>
          </div>
        )}

        {!submitted && (
          <p className="text-xs text-center font-semibold text-neutral-500 dark:text-neutral-400">
            {mafiaState?.pendingNightActions || 0} night{' '}
            {(mafiaState?.pendingNightActions || 0) === 1 ? 'action' : 'actions'} still pending.
          </p>
        )}
      </div>

      {/* Host controls */}
      <div className="pt-3">
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
            The town wakes up when the night ends.
          </p>
        )}
      </div>
    </div>
  );
}
