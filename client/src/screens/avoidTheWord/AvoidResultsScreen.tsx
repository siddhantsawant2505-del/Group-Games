import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { ArrowRight, Award, Crown, RotateCcw, Skull, Trophy, Users2 } from 'lucide-react';
import { AvoidPlacement, Player, RoomPublicState } from '@shared/types';
import { ActionButton } from '../../components/ActionButton';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { TeamLeaderboard, teamRowsFromRoom } from '../../components/TeamLeaderboard';

interface AvoidResultsScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onNextRound: () => void;
  onReturnToLobby: () => void;
  onEndSession: () => void;
}

const PLACEMENT_SUFFIX: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };

function placementLabel(placement: number): string {
  const suffix =
    placement % 100 >= 11 && placement % 100 <= 13
      ? 'th'
      : PLACEMENT_SUFFIX[placement] || 'th';
  return `${placement}${suffix}`;
}

/**
 * Avoid the Word — Final Standings.
 * Placement follows the elimination order (last one out places highest, players
 * knocked out in the same round tie) and the winners or winning team are crowned.
 */
export function AvoidResultsScreen({
  room,
  myPlayer,
  onNextRound,
  onReturnToLobby,
  onEndSession,
}: AvoidResultsScreenProps) {
  const results = room.results;
  const placements: AvoidPlacement[] = results?.avoidPlacements || [];
  const winners = placements.filter((entry) => entry.isWinner);
  const teamRows = room.playMode === 'team' ? teamRowsFromRoom(room) : [];
  const myPlacement = placements.find((entry) => entry.playerId === myPlayer.id);
  const roundsPlayed = results?.avoidRoundsPlayed || 0;

  useEffect(() => {
    if (winners.length === 0) return;
    try {
      confetti({
        particleCount: 60,
        spread: 64,
        origin: { y: 0.6 },
        colors: ['#FF5A5F', '#3AA0FF', '#FFC93C', '#4CD787', '#9B6DFF', '#FF6FB0'],
      });
    } catch {
      // ignore
    }
  }, [winners.length]);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div className="pb-4">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-xs font-black text-amber-800 dark:text-amber-200 mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>{results?.winnerTitle || 'Game Over'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
            {results?.summary || 'The last word is in!'}
          </h2>

          <span className="text-xs font-bold text-neutral-400 block mt-1">
            {roundsPlayed} {roundsPlayed === 1 ? 'round' : 'rounds'} played · {placements.length}{' '}
            players
          </span>
        </div>

        {/* Winner spotlight */}
        {winners.length > 0 && (
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="party-card p-5 rounded-3xl mb-4 text-center border border-amber-300/60 dark:border-amber-800/60"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1.5 mb-2">
              {(results?.avoidWinnerTeamNames || []).length > 0 ? (
                <Users2 className="w-3.5 h-3.5" />
              ) : (
                <Crown className="w-3.5 h-3.5" />
              )}
              <span>
                {(results?.avoidWinnerTeamNames || []).length > 0
                  ? 'Winning Team'
                  : winners.length === 1
                  ? 'Sole Survivor'
                  : 'Survivors'}
              </span>
            </span>

            {(results?.avoidWinnerTeamNames || []).length > 0 && (
              <h3 className="text-xl font-black tracking-tight text-[var(--text-primary)] mb-1">
                {(results?.avoidWinnerTeamNames || []).join(' & ')}
              </h3>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              {winners.map((winner) => (
                <span
                  key={winner.playerId}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800"
                >
                  <PlayerAvatar
                    name={winner.playerName}
                    colorIndex={winner.colorIndex}
                    size="xs"
                  />
                  <span className="text-sm font-black text-[var(--text-primary)]">
                    {winner.playerName}
                    {winner.playerId === myPlayer.id && ' (You)'}
                  </span>
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Your own finish */}
        {myPlacement && (
          <div className="p-3 rounded-2xl mb-4 flex items-center gap-2.5 bg-[var(--surface-card-subtle)]">
            <Award
              className="w-5 h-5 shrink-0"
              style={{ color: myPlacement.isWinner ? '#22C55E' : '#A3A3A3' }}
            />
            <div className="text-left min-w-0">
              <span className="text-xs font-black text-[var(--text-primary)] block">
                You finished {placementLabel(myPlacement.placement)}
                {myPlacement.isWinner && ' — winner!'}
              </span>
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
                {myPlacement.eliminatedRound === null
                  ? 'Never knocked out'
                  : `Knocked out in round ${myPlacement.eliminatedRound}`}
                {myPlacement.pointsAdded > 0
                  ? ` · +${myPlacement.pointsAdded} point${myPlacement.pointsAdded === 1 ? '' : 's'}`
                  : ' · no points'}
              </span>
            </div>
          </div>
        )}

        {/* Team mode first, then the individual placements */}
        {teamRows.length > 0 && (
          <TeamLeaderboard rows={teamRows} myTeamId={myPlayer.teamId} title="Team Standings" />
        )}

        <div className="party-card p-5 rounded-3xl mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Skull className="w-3.5 h-3.5" />
              <span>Placements</span>
            </span>
            <span className="text-xs text-neutral-400 font-bold">Last out places highest</span>
          </div>

          <div className="space-y-2">
            {placements.map((entry, index) => (
              <motion.div
                key={entry.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="p-2.5 rounded-2xl border flex items-center gap-2.5"
                style={{
                  backgroundColor: entry.isWinner
                    ? 'rgba(16, 185, 129, 0.10)'
                    : 'var(--surface-card-subtle)',
                  borderColor: entry.isWinner
                    ? 'rgba(16, 185, 129, 0.35)'
                    : 'var(--border-subtle)',
                }}
              >
                <span className="w-9 shrink-0 text-center text-xs font-black text-neutral-400">
                  {placementLabel(entry.placement)}
                </span>

                <PlayerAvatar name={entry.playerName} colorIndex={entry.colorIndex} size="sm" />

                <div className="min-w-0 flex-1 text-left">
                  <span className="text-sm font-extrabold text-[var(--text-primary)] block leading-tight truncate">
                    {entry.playerName}
                    {entry.playerId === myPlayer.id && ' (You)'}
                  </span>
                  <span className="text-[11px] font-semibold text-neutral-400 block">
                    {entry.eliminatedRound === null
                      ? 'Survived to the end'
                      : `Out in round ${entry.eliminatedRound}`}
                    {entry.teamName ? ` · ${entry.teamIcon} ${entry.teamName}` : ''}
                  </span>
                </div>

                <div className="shrink-0 text-right">
                  {entry.pointsAdded > 0 && (
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 block">
                      +{entry.pointsAdded} pt
                    </span>
                  )}
                  <span className="text-sm font-black text-[var(--text-primary)]">
                    {entry.totalScore} {entry.totalScore === 1 ? 'pt' : 'pts'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-[11px] font-semibold text-neutral-400 mt-3 leading-relaxed">
            {results?.whyHint ||
              'The anchor scores +1 for every player who matched, and winners score +3.'}
          </p>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="pt-2 space-y-2">
        {myPlayer.isHost ? (
          <>
            <ActionButton
              variant="shared"
              onClick={onNextRound}
              icon={<ArrowRight className="w-5 h-5" />}
              subtext="Everybody back in for a brand-new game"
            >
              Play Another Game
            </ActionButton>

            <ActionButton
              variant="subtle"
              onClick={onReturnToLobby}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Return to Lobby
            </ActionButton>

            <ActionButton
              variant="subtle"
              onClick={onEndSession}
              icon={<Trophy className="w-4 h-4 text-amber-500" />}
              subtext="View final session standings"
            >
              End Session
            </ActionButton>
          </>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center">
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Waiting for the host to start another game or return to lobby...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
