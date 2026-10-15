import { Crown, EyeOff, Hourglass, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Player, PlayerPrivateState, RoomPublicState } from '@shared/types';
import { Timer } from '../../components/Timer';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { getPlayerColor } from '@shared/theme/tokens';
import { AvoidAnswerForm } from './AvoidAnswerForm';
import { AvoidMatchedBanner } from './AvoidMatchedBanner';
import { AvoidStatusStrip } from './AvoidStatusStrip';

interface AvoidTurnScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onSubmitAnswer: (raw: string, targetPlayerId?: string) => void;
}

/**
 * Avoid the Word — Answer Window.
 * Serves both the anchor's private answer (phase 'avoid-anchor') and every turn
 * (phase 'avoid-turn'): the player whose input is open gets the form, everyone
 * else gets the turn banner, the live match announcement and the status strip.
 */
export function AvoidTurnScreen({
  room,
  myPlayer,
  privateState,
  onSubmitAnswer,
}: AvoidTurnScreenProps) {
  const avoid = room.avoidState;
  const isAnchorWindow = privateState.avoidIsActive && Boolean(privateState.avoidIsAnchor);
  const isMyTurn = privateState.avoidIsActive && Boolean(privateState.avoidQuestion);
  const playerColor = getPlayerColor(myPlayer.colorIndex);

  const alivePlayerIds = avoid?.alivePlayerIds || room.players.map((player) => player.id);
  const eligiblePlayers = room.players.filter((player) => alivePlayerIds.includes(player.id));

  const activeName = avoid?.activePlayerName || 'Someone';
  const matchedName =
    room.players.find((player) => player.id === avoid?.lastMatchedPlayerId)?.name || '';
  const matchedKey = avoid?.lastMatchedPlayerId || '';

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black"
            style={
              isMyTurn
                ? { backgroundColor: `${playerColor.hex}1F`, color: 'var(--text-primary)' }
                : { backgroundColor: 'rgba(245, 158, 11, 0.14)', color: '#B45309' }
            }
          >
            {isAnchorWindow ? <Crown className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
            <span>{isAnchorWindow ? 'Anchor answering' : 'Turn in progress'}</span>
          </span>

          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
            {isAnchorWindow || !avoid?.totalTurns
              ? `Round ${avoid?.roundNumber ?? room.roundNumber}`
              : `Turn ${avoid.turnNumber} of ${avoid.totalTurns}`}
          </span>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label={isMyTurn ? 'Time to answer' : `${activeName} is answering`}
          />
        )}
      </div>

      <div className="my-auto space-y-3 w-full">
        <AvoidMatchedBanner playerName={matchedName} matchKey={matchedKey} />

        {isMyTurn ? (
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="party-card p-5 rounded-3xl"
            style={{ boxShadow: `0 10px 26px ${playerColor.hex}1A` }}
          >
            <div className="text-center mb-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400 block mb-1">
                {isAnchorWindow ? 'You are the Anchor' : 'Your turn'}
              </span>
              <h2 className="text-xl font-black text-[var(--text-primary)] leading-tight">
                {isAnchorWindow
                  ? 'Pick the answer the group is most likely to say'
                  : "Answer without matching the anchor's answer"}
              </h2>
              <span className="text-[11px] font-semibold text-neutral-400 flex items-center justify-center gap-1 mt-1">
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hidden from everyone until the round reveal</span>
              </span>
            </div>

            <AvoidAnswerForm
              answerType={avoid?.answerType || privateState.avoidAnswerType || 'text'}
              question={privateState.avoidQuestion}
              choices={privateState.avoidChoices}
              numberRange={privateState.avoidNumberRange}
              eligiblePlayers={eligiblePlayers}
              myPlayerId={myPlayer.id}
              myColorIndex={myPlayer.colorIndex}
              submitLabel={isAnchorWindow ? 'Lock In Anchor Answer' : 'Submit Answer'}
              submitSubtext={
                isAnchorWindow
                  ? 'Everyone else will try to avoid this, and you score per match'
                  : 'Matching the anchor gets you knocked out'
              }
              onSubmit={onSubmitAnswer}
            />
          </motion.div>
        ) : (
          <div className="text-center">
            <div className="flex items-center justify-center mb-3">
              <PlayerAvatar
                name={activeName}
                colorIndex={
                  room.players.find((player) => player.id === avoid?.activePlayerId)?.colorIndex ?? 0
                }
                size="md"
              />
            </div>

            <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)] leading-tight mb-1">
              {activeName} is answering...
            </h2>

            <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-1.5">
              <Hourglass className="w-4 h-4" />
              <span>
                {privateState.avoidAlive === false
                  ? 'You are spectating — eliminated players never see answers early'
                  : 'Your turn starts as soon as they lock in'}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 space-y-3">
        {avoid && (
          <div className="party-card p-3 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                Table
              </span>
              <span className="text-[10px] font-black text-neutral-400">
                {avoid.matchedPlayerIds.length} matched so far
              </span>
            </div>
            <AvoidStatusStrip
              statuses={avoid.statuses}
              anchorPlayerId={avoid.anchorPlayerId}
              activePlayerId={avoid.activePlayerId}
              myPlayerId={myPlayer.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}
