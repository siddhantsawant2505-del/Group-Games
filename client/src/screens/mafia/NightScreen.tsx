import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  HeartPulse,
  Moon,
  Search,
  Skull,
  Users,
  Lock,
} from 'lucide-react';
import { Player, PlayerPrivateState, RoomPublicState } from '@shared/types';
import { Timer } from '../../components/Timer';
import { ActionButton } from '../../components/ActionButton';
import { PlayerChip } from '../../components/PlayerChip';

export interface MafiaTeamPick {
  playerId: string;
  playerName: string;
  targetName: string | null;
}

interface NightScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  /** Live faction-private picks pushed only to living Mafia. */
  teamPicks?: MafiaTeamPick[] | null;
  onSelectTarget: (targetPlayerId: string | null) => void;
  onHostResolveNight: () => void;
}

/**
 * Mafia — Night.
 *
 * ONE component for every role. Header, timer, player grid, confirm row and
 * spectator layout are identical whether the player is Mafia, Doctor, Detective
 * or a Townsperson with a decoy, so nothing about the screen (or its timing)
 * narrows down a role. Only the prompt text and the private notes below the grid
 * differ — and those belong to the player looking at their own phone.
 */
export function NightScreen({
  room,
  myPlayer,
  privateState,
  teamPicks,
  onSelectTarget,
  onHostResolveNight,
}: NightScreenProps) {
  const state = room.mafiaState;
  const alive = state?.alivePlayerIds ?? room.players.map((player) => player.id);
  const isAlive = privateState.mafiaIsAlive !== false;
  const role = privateState.mafiaRole ?? 'townsperson';
  const submitted = Boolean(privateState.mafiaActionSubmitted);
  const teammateIds = privateState.mafiaTeammateIds ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A new night clears the local pick; the server holds the locked one.
  useEffect(() => {
    setSelectedId(null);
  }, [state?.nightNumber]);

  // The live team update and the broadcast private state carry the same picks;
  // the push event wins when it is present.
  const picks: MafiaTeamPick[] =
    teamPicks ??
    (privateState.mafiaTeamSelections ?? []).map((selection) => ({
      playerId: '',
      playerName: selection.playerName,
      targetName: selection.targetName,
    }));

  const lastProtectedName = privateState.mafiaLastProtectedName ?? null;
  const targets = room.players.filter((player) => {
    if (!alive.includes(player.id)) return false;
    // The Doctor may protect themselves; every other role picks someone else.
    if (player.id === myPlayer.id && role !== 'doctor') return false;
    if (role === 'mafia' && teammateIds.includes(player.id)) return false;
    if (role === 'doctor' && lastProtectedName === player.name) return false;
    return true;
  });

  const accent =
    role === 'mafia' ? '#EF4444' : role === 'detective' ? '#6366F1' : role === 'doctor' ? '#14B8A6' : '#64748B';

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
            <Moon className="w-3.5 h-3.5" />
            <span>Night {state?.nightNumber ?? 1}</span>
          </span>
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Private</span>
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Time Until Sunrise"
          />
        )}

        <p className="text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {state?.nightConfirmedCount ?? 0} of {state?.nightActorCount ?? alive.length} confirmed
        </p>
      </div>

      {!isAlive ? (
        <div className="party-card p-6 rounded-3xl text-center my-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-neutral-500/10 text-neutral-400 flex items-center justify-center mb-3">
            <Eye className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)] mb-1">
            Watching from the square
          </h2>
          <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            You are out of the game. The village is making its choices — you will see the result
            in the morning.
          </p>
        </div>
      ) : (
        <div className="my-auto space-y-3">
          <div className="party-card p-5 rounded-3xl">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accent}1F`, color: accent }}
              >
                {role === 'mafia' ? (
                  <Skull className="w-4 h-4" />
                ) : role === 'detective' ? (
                  <Search className="w-4 h-4" />
                ) : role === 'doctor' ? (
                  <HeartPulse className="w-4 h-4" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                {privateState.mafiaActionLabel ?? 'Your night'}
              </span>
            </div>

            <h2 className="text-lg font-black text-[var(--text-primary)] leading-snug mb-3">
              {privateState.mafiaActionPrompt ?? 'Who do you trust the most tonight?'}
            </h2>

            {submitted ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                    Locked in
                  </span>
                </div>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {privateState.mafiaActionTargetName
                    ? `Your choice: ${privateState.mafiaActionTargetName}.`
                    : 'You confirmed with no target.'}
                </span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {targets.map((player) => (
                    <PlayerChip
                      key={player.id}
                      name={player.name}
                      colorIndex={player.colorIndex}
                      isHost={player.isHost}
                      size="md"
                      selectable
                      selected={selectedId === player.id}
                      onClick={() => setSelectedId(player.id)}
                    />
                  ))}
                </div>

                {targets.length === 0 && (
                  <p className="text-xs font-semibold text-neutral-400 mt-2">
                    Nobody legal to choose tonight.
                  </p>
                )}

                <div className="mt-4">
                  <ActionButton
                    variant="personal"
                    playerColorIndex={myPlayer.colorIndex}
                    disabled={!selectedId}
                    onClick={() => selectedId && onSelectTarget(selectedId)}
                    icon={<Moon className="w-5 h-5" />}
                    subtext="Held privately until morning"
                  >
                    Confirm Choice
                  </ActionButton>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectTarget(null)}
                  className="w-full mt-2 text-[11px] font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
                >
                  Confirm without choosing
                </button>
              </>
            )}
          </div>

          {/* Mafia coordination: only living Mafia ever receive these picks. */}
          {role === 'mafia' && (
            <div className="party-card p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5" />
                <span>Family coordination</span>
              </span>

              <div className="space-y-1.5">
                {picks.map((pick) => (
                  <div
                    key={`${pick.playerId}-${pick.playerName}`}
                    className="flex items-center justify-between gap-2 text-xs font-bold"
                  >
                    <span className="text-neutral-500 dark:text-neutral-400 truncate">
                      {pick.playerName}
                      {(pick.playerId === myPlayer.id || pick.playerName === myPlayer.name) &&
                        ' (You)'}
                    </span>
                    <span className="text-[var(--text-primary)] shrink-0">
                      {pick.targetName ?? 'choosing…'}
                    </span>
                  </div>
                ))}
                {picks.length === 0 && (
                  <span className="text-[11px] font-semibold text-neutral-400">
                    You are the only Mafia this game.
                  </span>
                )}
              </div>

              <p className="text-[10px] font-semibold text-neutral-400 mt-2">
                The family’s majority decides the victim. Ties are broken at random.
              </p>
            </div>
          )}

          {/* Detective case file: private to this player only. */}
          {role === 'detective' && (
            <div className="party-card p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
                <Eye className="w-3.5 h-3.5" />
                <span>Case file</span>
              </span>

              {(privateState.mafiaInvestigations ?? []).length === 0 ? (
                <p className="text-xs font-semibold text-neutral-400">
                  No findings yet — your first investigation is tonight.
                </p>
              ) : (
                <div className="space-y-1">
                  {(privateState.mafiaInvestigations ?? []).map((finding) => (
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
                  ))}
                </div>
              )}
            </div>
          )}

          {role === 'doctor' && privateState.mafiaLastProtectedName && (
            <p className="text-[11px] text-center font-semibold text-neutral-400">
              Last night you protected {privateState.mafiaLastProtectedName} — you cannot protect
              them again tonight.
            </p>
          )}
        </div>
      )}

      <div className="pt-3">
        {myPlayer.isHost ? (
          <ActionButton
            variant="subtle"
            onClick={onHostResolveNight}
            icon={<Moon className="w-4 h-4" />}
            subtext="Missing choices count as no action"
          >
            End the Night Now
          </ActionButton>
        ) : (
          <p className="text-xs text-center font-semibold text-neutral-400">
            The night ends when everyone has confirmed, or when the timer runs out.
          </p>
        )}
      </div>
    </div>
  );
}
