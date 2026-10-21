import { motion } from 'motion/react';
import { Eye, Moon, Search, Sun, Sunrise } from 'lucide-react';
import { MafiaRole, Player, PlayerPrivateState, RoomPublicState } from '@shared/types';
import { Timer } from '../../components/Timer';
import { ActionButton } from '../../components/ActionButton';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { MAFIA_ROLE_STYLES } from './roleTheme';

interface MorningScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onAdvance: () => void;
}

/**
 * Mafia — Morning.
 * The server narrates the night. The village hears who died (and their role only
 * when the host allowed it); the Detective alone sees their new finding.
 */
export function MorningScreen({ room, myPlayer, privateState, onAdvance }: MorningScreenProps) {
  const state = room.mafiaState;
  const victimName = state?.lastNightVictimName ?? null;
  const victimRole = state?.lastNightVictimRole ?? null;
  const finding = privateState.mafiaLastFinding ?? null;
  const isAlive = privateState.mafiaIsAlive !== false;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
            <Sunrise className="w-3.5 h-3.5" />
            <span>Morning {state?.dayNumber ?? 1}</span>
          </span>
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            <Sun className="w-3.5 h-3.5" />
            <span>Public report</span>
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Morning Report"
          />
        )}
      </div>

      <div className="my-auto space-y-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="party-card p-5 rounded-3xl"
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2">
            <Moon className="w-3.5 h-3.5" />
            <span>Whatever happened last night</span>
          </span>
          <p className="text-base font-bold text-[var(--text-primary)] leading-relaxed">
            {state?.morningNarration || 'The village wakes up.'}
          </p>
        </motion.div>

        {victimName ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl border border-rose-500/40 bg-rose-500/5 flex items-center gap-3"
          >
            <PlayerAvatar
              name={victimName}
              colorIndex={
                room.players.find((player) => player.name === victimName)?.colorIndex ?? 0
              }
              size="md"
            />
            <div className="min-w-0">
              <span className="text-sm font-black text-[var(--text-primary)] block leading-tight">
                {victimName} did not survive the night
              </span>
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                {victimRole
                  ? `They were the ${MAFIA_ROLE_STYLES[victimRole as MafiaRole].label}.`
                  : 'Their role stays a secret.'}
              </span>
            </div>
          </motion.div>
        ) : (
          <div className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/5">
            <span className="text-sm font-black text-[var(--text-primary)] block">
              Nobody died tonight
            </span>
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              The village is intact — which is its own kind of suspicious.
            </span>
          </div>
        )}

        {finding && isAlive && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-2xl border border-indigo-500/40 bg-indigo-500/5"
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5 mb-1">
              <Search className="w-3.5 h-3.5" />
              <span>Your investigation · private</span>
            </span>
            <span className="text-sm font-black text-[var(--text-primary)] block">
              {finding.targetName} {finding.isMafia ? 'is Mafia.' : 'is not Mafia.'}
            </span>
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              Only you can see this. Decide how much to share today.
            </span>
          </motion.div>
        )}

        {!isAlive && (
          <p className="text-[11px] text-center font-semibold text-neutral-400 flex items-center justify-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            <span>You are a spectator now — you see only what the village sees.</span>
          </p>
        )}
      </div>

      <div className="pt-3">
        {myPlayer.isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<Sunrise className="w-5 h-5" />}
            subtext="Start today's discussion"
          >
            Gather the Village
          </ActionButton>
        ) : (
          <p className="text-xs text-center font-semibold text-neutral-400">
            Today's discussion begins when the timer ends.
          </p>
        )}
      </div>
    </div>
  );
}
