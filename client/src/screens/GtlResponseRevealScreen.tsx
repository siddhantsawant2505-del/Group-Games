import { useState } from 'react';
import { Link2, ArrowRight, Lightbulb, Shuffle } from 'lucide-react';
import { RoomPublicState, Player, PlayerPrivateState } from '@shared/types';
import { Timer } from '../components/Timer';
import { RevealCard } from '../components/RevealCard';
import { ActionButton } from '../components/ActionButton';
import { getPlayerColor } from '@shared/theme/tokens';

interface GtlResponseRevealScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  privateState: PlayerPrivateState;
  onAdvance: () => void;
}

/**
 * Guess the Link — Link Board.
 * Every response is shown together in shuffled order, while each player keeps
 * their own angle in view. Nobody knows the concept yet.
 */
export function GtlResponseRevealScreen({
  room,
  myPlayer,
  privateState,
  onAdvance,
}: GtlResponseRevealScreenProps) {
  const isHost = myPlayer.isHost;
  const playerColor = getPlayerColor(myPlayer.colorIndex);
  const [hiddenCards, setHiddenCards] = useState<Record<string, boolean>>({});
  const gtl = room.gtlState;

  const toggleCard = (playerId: string) => {
    setHiddenCards((prev) => ({ ...prev, [playerId]: !prev[playerId] }));
  };

  const isMyResponse = (playerId: string) => playerId === myPlayer.id;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header */}
      <div>
        <div className="text-center mb-2">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-1"
            style={{ backgroundColor: `${playerColor.hex}18`, color: 'var(--text-primary)' }}
          >
            <Link2 className="w-3.5 h-3.5" style={{ color: playerColor.hex }} />
            <span>The Link Board</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)]">Find the Link</h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            What single concept ties every one of these responses together?
          </p>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Reading the Board"
          />
        )}

        {/* Own angle reminder */}
        <div
          className="p-3 rounded-2xl mt-3 flex items-center gap-2.5"
          style={{ backgroundColor: `${playerColor.hex}12` }}
        >
          <Lightbulb className="w-4 h-4 shrink-0" style={{ color: playerColor.hex }} />
          <div className="text-left min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
              Your angle
            </span>
            <span className="text-sm font-black text-[var(--text-primary)] truncate block">
              {privateState.gtlHint || 'Your angle'}
            </span>
          </div>
          {gtl?.category && (
            <span className="ml-auto shrink-0 text-[10px] font-black px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
              {gtl.category}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] font-bold text-neutral-400">
          <Shuffle className="w-3.5 h-3.5" />
          <span>Shuffled order — the concept itself stays hidden</span>
        </div>

        {/* Response grid */}
        <div className="space-y-3 mt-4">
          {room.revealedAnswers.map((ans, idx) => (
            <RevealCard
              key={ans.playerId}
              playerName={ans.playerName}
              playerColorIndex={ans.colorIndex}
              answerText={ans.answerText}
              revealed={!hiddenCards[ans.playerId]}
              subtext={
                isMyResponse(ans.playerId)
                  ? 'Your response'
                  : ans.answerText === '(No response)'
                  ? 'Ran out of time'
                  : undefined
              }
              isHost={isHost}
              onToggleReveal={() => toggleCard(ans.playerId)}
              indexDelay={idx}
            />
          ))}

          {room.revealedAnswers.length === 0 && (
            <p className="text-xs font-semibold text-neutral-400 text-center py-4">
              Waiting for responses to be compiled...
            </p>
          )}
        </div>
      </div>

      {/* Host advance */}
      <div className="pt-5 sticky bottom-0 bg-gradient-to-t from-[var(--bg-app)] via-[var(--bg-app)] to-transparent pb-2">
        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="Everyone guesses the concept at the same time"
          >
            Everyone Guesses Now
          </ActionButton>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center">
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Guessing opens when the host moves on or the timer runs out...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
