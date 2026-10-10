import { ArrowRight, Eye, ListOrdered, Shuffle } from 'lucide-react';
import { RoomPublicState, Player } from '@shared/types';
import { Timer } from '../components/Timer';
import { RevealCard } from '../components/RevealCard';
import { ActionButton } from '../components/ActionButton';
import { SpectrumBar } from '../components/SpectrumBar';
import { getPlayerColor } from '@shared/theme/tokens';

interface Top100BoardScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onAdvance: () => void;
}

/**
 * Top 100 — Example Board.
 * Every written example appears together in shuffled order. The secret numbers
 * are NOT shown: the table has to work them out from the examples themselves.
 */
export function Top100BoardScreen({ room, myPlayer, onAdvance }: Top100BoardScreenProps) {
  const isHost = myPlayer.isHost;
  const playerColor = getPlayerColor(myPlayer.colorIndex);
  const top100 = room.top100State;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      <div className="pb-24">
        {/* Header */}
        <div className="text-center mb-2">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-1"
            style={{ backgroundColor: `${playerColor.hex}18`, color: 'var(--text-primary)' }}
          >
            <ListOrdered className="w-3.5 h-3.5" style={{ color: playerColor.hex }} />
            <span>The Example Board</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)]">
            {top100?.playerCount || room.players.length} Examples, No Numbers
          </h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Which example belongs at the low end, and which one at the top?
          </p>
        </div>

        {room.timer && (
          <Timer
            secondsRemaining={room.timer.remainingSeconds}
            totalDuration={room.timer.durationSeconds}
            label="Reading the Board"
          />
        )}

        {/* Spectrum context (no markers — the numbers are still secret) */}
        {top100 && (
          <div className="party-card p-3 rounded-2xl mt-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-2">
              The Spectrum
            </span>
            <SpectrumBar lowLabel={top100.lowLabel} highLabel={top100.highLabel} compact />
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] font-bold text-neutral-400">
          <Shuffle className="w-3.5 h-3.5" />
          <span>Shuffled order — every number stays hidden</span>
        </div>

        {/* Examples */}
        <div className="space-y-3 mt-4">
          {room.revealedAnswers.map((ans, idx) => (
            <RevealCard
              key={ans.playerId}
              playerName={ans.playerName}
              playerColorIndex={ans.colorIndex}
              answerText={ans.answerText}
              revealed
              subtext={
                ans.playerId === myPlayer.id
                  ? 'Your example'
                  : ans.answerText === '(No example)'
                  ? 'Ran out of time'
                  : undefined
              }
              indexDelay={idx}
            />
          ))}

          {room.revealedAnswers.length === 0 && (
            <p className="text-xs font-semibold text-neutral-400 text-center py-4">
              Waiting for the examples to be compiled...
            </p>
          )}
        </div>
      </div>

      {/* Bottom control */}
      <div className="pt-5 sticky bottom-0 bg-gradient-to-t from-[var(--bg-app)] via-[var(--bg-app)] to-transparent pb-2">
        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onAdvance}
            icon={<ArrowRight className="w-5 h-5" />}
            subtext="You arrange the cards — everyone else watches live"
          >
            Start Ranking
          </ActionButton>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center flex items-center justify-center gap-2">
            <Eye className="w-3.5 h-3.5 text-neutral-400" />
            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              Ranking opens when the host moves on or the timer runs out...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
