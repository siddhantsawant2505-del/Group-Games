import { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Award,
  HeartPulse,
  RotateCcw,
  ScrollText,
  Search,
  Skull,
  Trophy,
  Users,
} from 'lucide-react';
import { MafiaRole, Player, RoomPublicState } from '@shared/types';
import { ActionButton } from '../../components/ActionButton';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { TeamLeaderboard, rowsFromStandings } from '../../components/TeamLeaderboard';
import { MAFIA_ROLE_STYLES, MafiaRoleIcon } from './roleTheme';

interface GameOverScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onNextRound: () => void;
  onReturnToLobby: () => void;
  onEndSession: () => void;
}

function RoleIcon({ icon, className }: { icon: MafiaRoleIcon; className: string }) {
  if (icon === 'skull') return <Skull className={className} />;
  if (icon === 'search') return <Search className={className} />;
  if (icon === 'heart') return <HeartPulse className={className} />;
  return <Users className={className} />;
}

const ROLE_BY_LABEL: Record<string, MafiaRole> = {
  Mafia: 'mafia',
  Detective: 'detective',
  Doctor: 'doctor',
  Townsperson: 'townsperson',
};

/**
 * Mafia — Game Over.
 * Full reveal: winning faction, every role, the night/day recap timeline, points
 * and the leaderboard (team totals first in team mode).
 */
export function GameOverScreen({
  room,
  myPlayer,
  onNextRound,
  onReturnToLobby,
  onEndSession,
}: GameOverScreenProps) {
  const results = room.results;
  const winningSide = results?.mafiaWinningSide ?? 'town';
  const mafiaWon = winningSide === 'mafia';
  const recap = results?.mafiaRecap ?? [];
  const teamRows = rowsFromStandings(results?.teamStandings);

  useEffect(() => {
    try {
      confetti({
        particleCount: 70,
        spread: 72,
        origin: { y: 0.62 },
        colors: mafiaWon
          ? ['#EF4444', '#7F1D1D', '#1A1B1E', '#DC2626']
          : ['#22C55E', '#4CD787', '#FFC93C', '#3AA0FF'],
      });
    } catch {
      // Confetti is cosmetic; a blocked canvas must never break the results.
    }
  }, [mafiaWon]);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="text-center mb-4">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-2"
            style={{
              backgroundColor: mafiaWon ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
              color: mafiaWon ? '#EF4444' : '#16A34A',
            }}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>{results?.winnerTitle ?? 'Game Over'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
            {mafiaWon ? 'The Mafia Took the Village' : 'The Village Survived'}
          </h2>

          <span className="text-[11px] font-bold text-neutral-400 block mt-1">
            {results?.mafiaDeathCount ?? 0} killed overnight · {results?.mafiaExileCount ?? 0}{' '}
            exiled
          </span>
        </div>

        {results?.whyHint && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-1">
              How the points landed
            </span>
            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200 leading-relaxed">
              {results.whyHint}
            </p>
          </div>
        )}

        {teamRows.length > 0 && (
          <TeamLeaderboard rows={teamRows} myTeamId={myPlayer.teamId} title="Team Standings" />
        )}

        {/* Every role */}
        <div className="party-card p-5 rounded-3xl mb-3 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
            Every role, revealed
          </span>

          {(results?.roleReveals ?? []).map((reveal, index) => {
            const role = ROLE_BY_LABEL[reveal.role] ?? 'townsperson';
            const style = MAFIA_ROLE_STYLES[role];
            return (
              <motion.div
                key={reveal.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.035 }}
                className="p-3 rounded-2xl flex items-center justify-between gap-2 border"
                style={{
                  backgroundColor: style.onDark ? style.background : 'var(--surface-card-subtle)',
                  borderColor: style.onDark ? `${style.accent}55` : 'var(--border-subtle)',
                  color: style.onDark ? '#F2F2F0' : 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar name={reveal.playerName} colorIndex={reveal.colorIndex} size="sm" />
                  <div className="min-w-0 text-left">
                    <span className="font-extrabold text-sm block leading-tight truncate">
                      {reveal.playerName}
                      {reveal.playerId === myPlayer.id && ' (You)'}
                    </span>
                    <span
                      className="text-[10px] block truncate"
                      style={{ color: style.onDark ? '#CFCFCF' : 'var(--text-secondary)' }}
                    >
                      {reveal.explanation}
                    </span>
                  </div>
                </div>

                <span
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg"
                  style={{ backgroundColor: `${style.accent}26`, color: style.accent }}
                >
                  <RoleIcon icon={style.icon} className="w-3 h-3" />
                  <span>{style.label.replace('The ', '')}</span>
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Recap timeline */}
        {recap.length > 0 && (
          <div className="party-card p-5 rounded-3xl mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
              <ScrollText className="w-3.5 h-3.5" />
              <span>Recap</span>
            </span>

            <div className="space-y-2">
              {recap.map((entry, index) => (
                <div
                  key={`${entry.kind}-${entry.label}-${index}`}
                  className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                    {entry.label}
                  </span>
                  {entry.lines.map((line, lineIndex) => (
                    <span
                      key={`${lineIndex}-${line}`}
                      className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300"
                    >
                      • {line}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual standings */}
        {results?.standings && (
          <div className="party-card p-5 rounded-3xl mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Running Scoreboard</span>
              </span>
              <span className="text-[10px] text-neutral-400 font-bold">Total</span>
            </div>

            <div className="space-y-1.5">
              {results.standings.map((standing, index) => (
                <div
                  key={standing.playerId}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 text-center text-[11px] font-black text-neutral-400">
                      #{index + 1}
                    </span>
                    <PlayerAvatar
                      name={standing.playerName}
                      colorIndex={standing.colorIndex}
                      size="xs"
                    />
                    <span className="font-extrabold text-xs text-[var(--text-primary)] truncate">
                      {standing.playerName}
                    </span>
                    {standing.badge && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 shrink-0">
                        {standing.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                        standing.pointsAdded > 0
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                          : 'text-neutral-400'
                      }`}
                    >
                      +{standing.pointsAdded}
                    </span>
                    <span className="font-black text-xs text-[var(--text-primary)]">
                      {standing.totalScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] font-semibold text-neutral-400 mt-2">
              +3 for every member of the winning faction, +1 more for each survivor.
            </p>
          </div>
        )}
      </div>

      <div className="pt-1 space-y-2">
        {myPlayer.isHost ? (
          <>
            <ActionButton
              variant="shared"
              onClick={onNextRound}
              icon={<ArrowRight className="w-5 h-5" />}
              subtext="Fresh roles, fresh night of suspicion"
            >
              Play Next Round
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
              Waiting for the host to start a new game or return to the lobby...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
