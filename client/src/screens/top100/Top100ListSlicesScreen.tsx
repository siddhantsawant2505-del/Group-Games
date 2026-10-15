import { ArrowRight, Hash, LogOut, Medal, Trophy } from 'lucide-react';
import { Player, RoomPublicState, Top100GuessRow } from '@shared/types';
import { ActionButton } from '../../components/ActionButton';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { TeamLeaderboard, rowsFromStandings } from '../../components/TeamLeaderboard';
import { top100CategoryLabel } from '@shared/data/top100Categories';

interface Top100ListSlicesScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  /** Host-only: deal the next question (rounds remaining). */
  onNextRound?: () => void;
  /** Host-only: end the session and show the post-game leaderboard. */
  onEndSession?: () => void;
  /** Any player: back to the lobby. */
  onReturnToLobby?: () => void;
}

/** A rank + name list (one of the two revealed slices). */
function SliceBlock({
  title,
  note,
  entries,
}: {
  title: string;
  note: string;
  entries: { rank: number; name: string }[];
}) {
  return (
    <div className="party-card p-4 rounded-3xl">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
        {title}
      </span>
      <p className="text-[10px] font-semibold text-neutral-400 mb-2">{note}</p>
      <ol className="space-y-1">
        {entries.map((entry) => (
          <li key={entry.rank} className="flex items-baseline gap-2 text-xs">
            <span className="w-7 shrink-0 text-right font-black text-neutral-400 tabular-nums">
              {entry.rank}
            </span>
            <span className="font-bold text-[var(--text-primary)] break-words">{entry.name}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Top 100 — List Slices (results phase).
 * Only ranks 1-10 and 90-100 are ever revealed; the middle of the list stays
 * hidden forever. Then the running leaderboard, teams first in team mode.
 */
export function Top100ListSlicesScreen({
  room,
  myPlayer,
  onNextRound,
  onEndSession,
  onReturnToLobby,
}: Top100ListSlicesScreenProps) {
  const state = room.top100State;
  const results = room.results;
  if (!state) return null;

  const slices = results?.top100Slices ?? state.slices;
  const isTeamMode = room.playMode === 'team' && room.teams.length > 0;
  const isFinal = Boolean(results?.top100IsFinal ?? state.finalRound);
  const myRowId = isTeamMode ? myPlayer.teamId : myPlayer.id;
  const myRow: Top100GuessRow | undefined = state.guesses.find((row) => row.rowId === myRowId);

  const inSlices = (rank: number | null) =>
    rank !== null && (rank <= 10 || rank >= 90);
  const showYourGuess = Boolean(myRow && myRow.matchedRank !== null && !inSlices(myRow.matchedRank));

  const teamRows = rowsFromStandings(results?.teamStandings);
  const standings = results?.standings ?? [];

  return (
    <div className="flex-1 flex flex-col p-5 max-w-md mx-auto w-full space-y-4 overflow-y-auto">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-black text-neutral-600 dark:text-neutral-400 mb-2">
          <Hash className="w-3.5 h-3.5" />
          <span>
            {isFinal
              ? `After ${state.roundCount} rounds`
              : `Round ${state.roundNumber} of ${state.roundCount} — Results`}
          </span>
        </span>
        <h2 className="text-base font-black text-[var(--text-primary)] leading-snug break-words">
          {state.question}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400">
            {top100CategoryLabel(state.category)}
          </span>
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
            {state.asOf}
          </span>
        </div>
      </div>

      {isFinal && results?.winnerTitle && (
        <div className="party-card p-4 rounded-3xl text-center border-2 border-amber-400/60 dark:border-amber-700/60">
          <Trophy className="w-7 h-7 text-amber-500 mx-auto mb-1" />
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 block">
            Final Standings
          </span>
          <p className="text-xl font-black text-[var(--text-primary)] break-words">
            {results.winnerTitle}
          </p>
        </div>
      )}

      {slices && (
        <div className="space-y-3">
          <SliceBlock
            title="Positions 1-10"
            note="The easiest names on this list — 1 to 10 points."
            entries={slices.top}
          />
          <SliceBlock
            title="Positions 90-100"
            note="The deepest names — 90 to 100 points."
            entries={slices.bottom}
          />
        </div>
      )}

      {showYourGuess && myRow && (
        <div className="party-card p-4 rounded-3xl">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1.5">
            Your guess
          </span>
          <div className="flex items-baseline gap-2">
            <span className="w-8 shrink-0 text-right font-black text-neutral-400 tabular-nums">
              {myRow.matchedRank}
            </span>
            <span className="text-sm font-bold text-[var(--text-primary)] break-words">
              “{myRow.text}” → {myRow.matchedName}
            </span>
          </div>
          <p className="text-[10px] font-semibold text-neutral-400 mt-1">
            Your guess sits outside the revealed slices — this is its position.
          </p>
        </div>
      )}

      {isTeamMode && teamRows.length > 0 && (
        <TeamLeaderboard rows={teamRows} myTeamId={myPlayer.teamId} title="Team Standings" />
      )}

      {standings.length > 0 && (
        <div className="party-card p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Medal className="w-3.5 h-3.5" />
              <span>{isTeamMode ? 'Captain Points' : 'Standings'}</span>
            </span>
            <span className="text-xs text-neutral-400 font-bold">Total</span>
          </div>

          <div className="space-y-2">
            {standings.map((entry) => (
              <div
                key={entry.playerId}
                className="flex items-center gap-2.5 rounded-2xl p-2"
                style={{
                  backgroundColor:
                    entry.playerId === myPlayer.id ? 'rgba(245, 158, 11, 0.10)' : undefined,
                }}
              >
                <span className="w-6 shrink-0 text-center text-xs font-black text-neutral-400 tabular-nums">
                  #{entry.rank ?? '-'}
                </span>
                <PlayerAvatar
                  name={entry.playerName}
                  colorIndex={entry.colorIndex}
                  size="sm"
                  isHost={room.players.find((p) => p.id === entry.playerId)?.isHost}
                />
                <span className="min-w-0 flex-1 text-sm font-extrabold text-[var(--text-primary)] truncate">
                  {entry.playerName}
                  {entry.playerId === myPlayer.id && ' (You)'}
                  {entry.badge && (
                    <span className="ml-1.5 text-[10px] font-black text-neutral-400">
                      {entry.badge}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-black text-[var(--text-primary)] tabular-nums">
                  {entry.pointsAdded > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 mr-1.5">
                      +{entry.pointsAdded}
                    </span>
                  )}
                  {entry.totalScore}
                </span>
              </div>
            ))}
          </div>

          {isTeamMode && (
            <p className="text-[10px] font-semibold text-neutral-400">
              Team points are the score here — individual totals are unchanged by Top 100.
            </p>
          )}
        </div>
      )}

      {results?.top100Source && (
        <p className="text-[10px] font-semibold text-neutral-400 text-center break-words">
          Ranking based on: {results.top100Question} — source: {results.top100Source}
        </p>
      )}

      {myPlayer.isHost ? (
        <div className="space-y-2 pb-2">
          {!isFinal && onNextRound && (
            <ActionButton
              variant="personal"
              playerColorIndex={myPlayer.colorIndex}
              onClick={onNextRound}
              icon={<ArrowRight className="w-5 h-5" />}
              subtext={`Round ${state.roundNumber + 1} of ${state.roundCount}`}
            >
              Next Round
            </ActionButton>
          )}
          {isFinal && onEndSession && (
            <ActionButton
              variant="personal"
              playerColorIndex={myPlayer.colorIndex}
              onClick={onEndSession}
              icon={<Trophy className="w-5 h-5" />}
              subtext="Session leaderboard"
            >
              End Session
            </ActionButton>
          )}
          {onReturnToLobby && (
            <button
              type="button"
              onClick={onReturnToLobby}
              className="w-full text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer underline"
            >
              <span className="inline-flex items-center gap-1">
                <LogOut className="w-3.5 h-3.5" />
                <span>Return everyone to the lobby</span>
              </span>
            </button>
          )}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-neutral-400 text-center pb-2">
          Waiting for the host to {isFinal ? 'end the session' : 'deal the next round'}.
        </p>
      )}
    </div>
  );
}
