import { useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import {
  RoomPublicState,
  Player,
  ImpostorSettings,
  AvoidSettings,
  Top100Settings,
  MafiaSettings,
  DIFFICULTY_LABELS,
  IMPOSTOR_MODE_LABELS,
  TOP100_TEAM_MIN_GUESS_SECONDS,
  TONE_LABELS,
  GameMetadata,
} from '@shared/types';
import { DEFAULT_GAME, PARTY_GAMES } from '@shared/data/games';
import { validateMafiaSettings } from '@shared/data/mafiaSetup';
import { GameCard } from '../components/GameCard';
import { ActionButton } from '../components/ActionButton';
import { GameSettingsSheet } from '../components/GameSettingsSheet';

const IMPOSTOR_GAME_ID = 'impostor';
const AVOID_THE_WORD_GAME_ID = 'avoid-the-word';
const TOP_100_GAME_ID = 'top-100';
const MAFIA_GAME_ID = 'mafia';

/** One-line summary of the settings a game card is currently running. */
function settingsSummaryFor(game: GameMetadata, room: RoomPublicState): string | undefined {
  if (game.id === AVOID_THE_WORD_GAME_ID) {
    const avoid = room.gameSettings.avoidTheWord;
    return `${avoid.anchorSeconds}s anchor · ${avoid.turnSeconds}s turns · ${TONE_LABELS[avoid.tone]}`;
  }

  if (game.id === TOP_100_GAME_ID) {
    const top100 = room.gameSettings.top100;
    // Team captains read suggestions first, so team rounds never run shorter
    // than the server's floor — show the timer they will actually get.
    const guessSeconds =
      room.playMode === 'team'
        ? Math.max(TOP100_TEAM_MIN_GUESS_SECONDS, top100.guessSeconds)
        : top100.guessSeconds;
    return `${top100.roundCount} rounds · ${guessSeconds}s guess · ${
      top100.duplicatePolicy === 'zero' ? 'dupes score 0' : 'dupes score'
    }`;
  }

  if (game.id === MAFIA_GAME_ID) {
    const mafia = room.gameSettings.mafia;
    const deal = validateMafiaSettings(room.players.length, mafia);
    return `${deal.breakdown.mafia} Mafia · ${mafia.nightSeconds}s night · ${mafia.discussionSeconds}s day`;
  }

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
  /** Impostor / Avoid the Word: host updates the public round settings. */
  onSaveGameSettings?: (
    patch: {
      impostor?: Partial<ImpostorSettings>;
      avoidTheWord?: Partial<AvoidSettings>;
      top100?: Partial<Top100Settings>;
      mafia?: Partial<MafiaSettings>;
    },
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
  // A Coming Soon game is never the active selection; fall back to the first
  // playable game (Top 100) when the room still points at an old choice.
  const currentSelectedId =
    room.selectedGame && !room.selectedGame.comingSoon
      ? room.selectedGame.id
      : DEFAULT_GAME.id;
  const [localSelectedId, setLocalSelectedId] = useState(currentSelectedId);
  /** The game whose settings sheet is open (gear on that game's card). */
  const [settingsGameId, setSettingsGameId] = useState<string | null>(null);

  const handleSelect = (gameId: string) => {
    const game = PARTY_GAMES.find((candidate) => candidate.id === gameId);
    if (!game || game.comingSoon) return;
    setLocalSelectedId(gameId);
    if (isHost) {
      onSelectGame(gameId);
    }
  };

  const selectedGame =
    PARTY_GAMES.find(
      (g) =>
        g.id === (isHost ? localSelectedId : currentSelectedId) && !g.comingSoon
    ) || DEFAULT_GAME;
  const settingsGame = PARTY_GAMES.find((g) => g.id === settingsGameId) || null;

  // Mafia validates the deal against the current table, so Start is blocked with
  // the exact reason instead of failing when the reveal begins.
  const mafiaDeal =
    selectedGame.id === MAFIA_GAME_ID
      ? validateMafiaSettings(room.players.length, room.gameSettings.mafia)
      : null;
  const launchError = mafiaDeal && !mafiaDeal.valid ? mafiaDeal.error : undefined;

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
                !game.comingSoon &&
                (isHost ? localSelectedId : currentSelectedId) === game.id
              }
              onSelect={() => handleSelect(game.id)}
              isHost={isHost}
              onOpenSettings={() => setSettingsGameId(game.id)}
              settingsSummary={settingsSummaryFor(game, room)}
            />
          ))}
        </div>

        {/* Each playable game's settings live behind the gear on its card. */}
        <p className="text-[11px] font-semibold text-neutral-400 text-center">
          Tap the gear on any playable card to tune that game. Cards marked Coming Soon
          cannot be launched yet.
        </p>

      </div>

      {/* Bottom controls */}
      <div className="pt-4 sticky bottom-0 bg-gradient-to-t from-[var(--bg-app)] via-[var(--bg-app)] to-transparent pb-2">
        {isHost ? (
          <ActionButton
            variant="shared"
            onClick={onConfirmAndStart}
            disabled={Boolean(launchError)}
            icon={<Play className="w-5 h-5 fill-current" />}
            subtext={launchError || `Launch round with ${selectedGame.title}`}
          >
            {launchError ? 'Cannot Start Yet' : 'Launch Round'}
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
