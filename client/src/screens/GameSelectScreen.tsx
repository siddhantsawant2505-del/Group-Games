import { useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import {
  RoomPublicState,
  Player,
  ImpostorSettings,
  DIFFICULTY_LABELS,
  IMPOSTOR_MODE_LABELS,
  TONE_LABELS,
  GameMetadata,
} from '@shared/types';
import { PARTY_GAMES } from '@shared/data/games';
import { GameCard } from '../components/GameCard';
import { ActionButton } from '../components/ActionButton';
import { GameSettingsSheet } from '../components/GameSettingsSheet';

const IMPOSTOR_GAME_ID = 'impostor';

/** One-line summary of the settings a game card is currently running. */
function settingsSummaryFor(game: GameMetadata, room: RoomPublicState): string | undefined {
  if (game.id !== IMPOSTOR_GAME_ID) return undefined;
  const settings = room.gameSettings.impostor;
  return settings.mode === 'question'
    ? `${IMPOSTOR_MODE_LABELS.question} · ${TONE_LABELS[settings.tone]}`
    : `${IMPOSTOR_MODE_LABELS.word} · ${DIFFICULTY_LABELS[settings.difficulty]}${
        settings.theme ? ` · ${settings.theme}` : ''
      }`;
}

interface GameSelectScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onSelectGame: (gameId: string) => void;
  onConfirmAndStart: () => void;
  /** Guess the Link only: host saves a custom concept (blank payload clears it). */
  onSaveGtlPrompt?: (
    input: { concept: string; category?: string; hints?: string[] },
    callback: (res: { success: boolean; error?: string; prompt?: { concept: string; category: string; hints: string[] } | null }) => void
  ) => void;
  /** Impostor only: host updates the public round settings. */
  onSaveGameSettings?: (
    patch: { impostor?: Partial<ImpostorSettings> },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
}

export function GameSelectScreen({
  room,
  myPlayer,
  onSelectGame,
  onConfirmAndStart,
  onSaveGtlPrompt,
  onSaveGameSettings,
}: GameSelectScreenProps) {
  const isHost = myPlayer.isHost;
  const currentSelectedId = room.selectedGame?.id || PARTY_GAMES[0].id;
  const [localSelectedId, setLocalSelectedId] = useState(currentSelectedId);
  /** The game whose settings sheet is open (gear on that game's card). */
  const [settingsGameId, setSettingsGameId] = useState<string | null>(null);

  const handleSelect = (gameId: string) => {
    setLocalSelectedId(gameId);
    if (isHost) {
      onSelectGame(gameId);
    }
  };

  const selectedGame =
    PARTY_GAMES.find((g) => g.id === (isHost ? localSelectedId : currentSelectedId)) ||
    PARTY_GAMES[0];
  const settingsGame = PARTY_GAMES.find((g) => g.id === settingsGameId) || null;

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Header */}
      {/* pb keeps the last controls scrollable clear of the sticky Launch bar,
          so its tap target can never be covered by it on short screens. */}
      <div className="pb-28">
        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Party Game Collection</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            Select Game
          </h2>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
            {isHost
              ? 'Tap a game card to pick the round format'
              : 'Host is selecting the game...'}
          </p>
        </div>

        {/* Game cards grid */}
        <div className="space-y-3 pb-4">
          {PARTY_GAMES.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              selected={
                (isHost ? localSelectedId : currentSelectedId) === game.id
              }
              onSelect={() => handleSelect(game.id)}
              isHost={isHost}
              onOpenSettings={() => setSettingsGameId(game.id)}
              settingsSummary={settingsSummaryFor(game, room)}
            />
          ))}
        </div>

        {/* Each game's own settings live behind the gear on its card. */}
        <p className="text-[11px] font-semibold text-neutral-400 text-center">
          Tap the gear on any card to tune just that game.
        </p>

      </div>

      {/* Bottom controls */}
      <div className="pt-4 sticky bottom-0 bg-gradient-to-t from-[var(--bg-app)] via-[var(--bg-app)] to-transparent pb-2">
        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onConfirmAndStart}
            icon={<Play className="w-5 h-5 fill-current" />}
            subtext={`Launch round with ${selectedGame.title}`}
          >
            Launch Round
          </ActionButton>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center">
            <span className="text-sm font-bold text-neutral-600 dark:text-neutral-300">
              Host selected: <strong className="text-[var(--text-primary)]">{selectedGame.title}</strong>
            </span>
            <p className="text-xs text-neutral-400 mt-0.5">
              Get your phone ready for the secret reveal!
            </p>
          </div>
        )}
      </div>

      {/* One sheet, whichever card's gear was tapped */}
      <GameSettingsSheet
        game={settingsGame}
        open={Boolean(settingsGame)}
        room={room}
        myPlayer={myPlayer}
        onClose={() => setSettingsGameId(null)}
        onSaveGameSettings={onSaveGameSettings}
        onSaveGtlPrompt={onSaveGtlPrompt}
      />
    </div>
  );
}
