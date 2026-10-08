import { motion } from 'motion/react';
import { Skull, Search, Users, Lock, ArrowRight, Moon } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState, MafiaRole } from '@shared/types';
import { Timer } from '../components/Timer';
import { ActionButton } from '../components/ActionButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PlayerChip } from '../components/PlayerChip';

interface MafiaRevealScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onAdvance: () => void;
}

interface RoleTheme {
  label: string;
  tagline: string;
  accent: string;
  background: string;
  icon: 'skull' | 'search' | 'users';
}

/** Distinct themed card per role, built from the existing design tokens. */
const ROLE_THEMES: Record<MafiaRole, RoleTheme> = {
  mafia: {
    label: 'The Mafia',
    tagline: 'Kill by night. Blend in by day.',
    accent: '#EF4444',
    background: '#2B1113',
    icon: 'skull',
  },
  detective: {
    label: 'The Detective',
    tagline: 'Investigate one player every night.',
    accent: '#6366F1',
    background: '#1B1A3A',
    icon: 'search',
  },
  townsperson: {
    label: 'Townsperson',
    tagline: 'No night action — hunt the Mafia by day.',
    accent: '#22C55E',
    background: 'var(--surface-card)',
    icon: 'users',
  },
};

function RoleIcon({ icon, className }: { icon: RoleTheme['icon']; className: string }) {
  if (icon === 'skull') return <Skull className={className} />;
  if (icon === 'search') return <Search className={className} />;
  return <Users className={className} />;
}

/**
 * Mafia — Role Reveal.
 * Each player privately sees only their own role, with a distinct themed card.
 */
export function MafiaRevealScreen({
  room,
  myPlayer,
  privateState,
  onAdvance,
}: MafiaRevealScreenProps) {
  const role: MafiaRole = privateState.mafiaRole || 'townsperson';
  const theme = ROLE_THEMES[role];
  const isDarkCard = role !== 'townsperson';
  const teammates = privateState.mafiaTeammateNames || [];
  const mafiaState = room.mafiaState;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Round header + timer */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            Round {room.roundNumber} • {room.selectedGame?.title || 'Mafia'}
          </span>

          <span className="text-xs font-bold flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Keep Screen Hidden</span>
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Reveal Window"
          />
        )}
      </div>

      {/* Themed role card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 24 }}
        className="p-6 rounded-3xl text-center shadow-lg my-auto border"
        style={{
          backgroundColor: theme.background,
          borderColor: isDarkCard ? `${theme.accent}66` : 'var(--border-subtle)',
          color: isDarkCard ? '#F2F2F0' : 'var(--text-primary)',
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <PlayerAvatar
            name={myPlayer.name}
            colorIndex={myPlayer.colorIndex}
            size="md"
            isHost={myPlayer.isHost}
          />
        </div>

        <div className="flex items-center justify-center mb-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `${theme.accent}22`,
              color: theme.accent,
              boxShadow: `0 0 0 6px ${theme.accent}14`,
            }}
          >
            <RoleIcon icon={theme.icon} className="w-9 h-9" />
          </div>
        </div>

        <span
          className="text-xs font-black uppercase tracking-widest block mb-1"
          style={{ color: isDarkCard ? theme.accent : 'var(--text-secondary)' }}
        >
          Your Secret Role
        </span>

        <h2 className="text-3xl font-black tracking-tight mb-2">{theme.label}</h2>

        <p
          className="text-sm font-bold mb-4"
          style={{ color: isDarkCard ? '#D9D9D9' : 'var(--text-secondary)' }}
        >
          {theme.tagline}
        </p>

        {/* Mafia teammates */}
        {role === 'mafia' && (
          <div
            className="p-4 rounded-2xl mb-4 text-left"
            style={{ backgroundColor: '#FFFFFF12', border: `1px solid ${theme.accent}55` }}
          >
            <span className="text-[11px] font-black uppercase tracking-wider block mb-2" style={{ color: theme.accent }}>
              {teammates.length > 0 ? 'Your Family' : 'You work alone'}
            </span>

            {teammates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {teammates.map((name) => (
                  <span
                    key={name}
                    className="px-2.5 py-1 rounded-full text-xs font-black"
                    style={{ backgroundColor: `${theme.accent}26`, color: '#FFFFFF' }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs font-semibold text-neutral-300">
                Nobody else is on your side — stay invisible.
              </span>
            )}
          </div>
        )}

        {/* Town knowledge */}
        {mafiaState && (
          <div
            className="p-3 rounded-2xl mb-4 text-xs font-bold"
            style={{
              backgroundColor: isDarkCard ? '#FFFFFF10' : 'var(--surface-card-subtle)',
              color: isDarkCard ? '#E5E5E5' : 'var(--text-secondary)',
            }}
          >
            <span className="block">
              {mafiaState.mafiaCount} {mafiaState.mafiaCount === 1 ? 'Mafia member is' : 'Mafia members are'} hiding among{' '}
              {room.players.length} players
            </span>
            <span className="block mt-1 opacity-80">
              {mafiaState.hasDetective ? 'A Detective is among the town.' : 'No Detective this game.'}
            </span>
          </div>
        )}

        <p
          className="text-sm leading-relaxed font-medium"
          style={{ color: isDarkCard ? '#CFCFCF' : 'var(--text-secondary)' }}
        >
          {privateState.secretInstructions || 'Prepare for the first night.'}
        </p>
      </motion.div>

      {/* Host advance */}
      <div className="pt-4 space-y-2">
        <p className="text-xs text-center font-semibold text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-1.5">
          <Moon className="w-3.5 h-3.5" />
          <span>Night 1 begins next — Mafia and the Detective wake up first.</span>
        </p>

        {myPlayer.isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Ready? Skip waiting for the timer"
          >
            Begin Night 1
          </ActionButton>
        ) : (
          <p className="text-xs text-center font-semibold text-neutral-400">
            Auto-advancing when the timer expires...
          </p>
        )}
      </div>
    </div>
  );
}
