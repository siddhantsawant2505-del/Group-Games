import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  LogIn,
  Users,
  X,
  RotateCcw,
  Smartphone,
  HelpCircle,
  Clock3,
} from 'lucide-react';
import { PARTY_GAMES, PLAYABLE_GAMES } from '@shared/data/games';
import { GameMetadata } from '@shared/types';
import { PLAYER_COLORS, getGameThemeColor } from '@shared/theme/tokens';
import { ActionButton } from '../components/ActionButton';
import { GameIcon } from '../components/GameIcon';
import { PlayerAvatar } from '../components/PlayerAvatar';

interface HomeScreenProps {
  playerName: string;
  playerColorIndex: number;
  onCreateRoom: () => void;
  onNavigateToJoin: () => void;
  onEditProfile: () => void;
  onReconnect?: (roomCode: string, sessionToken: string) => void;
  savedSession?: {
    roomCode: string | null;
    playerId: string | null;
    sessionToken: string | null;
    playerName: string | null;
  } | null;
  loading?: boolean;
  errorMessage?: string | null;
  onClearError?: () => void;
  connected?: boolean;
}

export function HomeScreen({
  playerName,
  playerColorIndex,
  onCreateRoom,
  onNavigateToJoin,
  onEditProfile,
  onReconnect,
  savedSession,
  loading = false,
  errorMessage,
  onClearError,
  connected = true,
}: HomeScreenProps) {
  const [previewGame, setPreviewGame] = useState<GameMetadata | null>(null);

  const colorToken = PLAYER_COLORS[playerColorIndex] || PLAYER_COLORS[0];
  const hasActiveSavedSession = Boolean(
    savedSession?.roomCode && savedSession?.sessionToken && onReconnect
  );

  return (
    <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
      {/* Top Bar with Brand & Player Avatar Chip */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between pb-3 border-b-2 border-[var(--border-neo)]"
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#86EFAC] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-center font-black text-lg">
            🎮
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
                Party Games
              </h1>
              <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-[#FEF08A] text-[#18181B] border border-[var(--border-neo)] -rotate-2">
                LIVE
              </span>
            </div>
            <p className="text-[11px] font-bold opacity-60">
              Phone-as-controller party engine
            </p>
          </div>
        </div>

        {/* Corner Player Avatar Chip - clickable to edit profile */}
        <button
          type="button"
          onClick={onEditProfile}
          title="Edit Profile"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] transition-all cursor-pointer tactile-btn"
        >
          <PlayerAvatar
            name={playerName}
            colorHex={colorToken.hex}
            size="xs"
          />
          <span className="text-xs font-black text-[var(--text-primary)] max-w-[90px] truncate">
            {playerName}
          </span>
        </button>
      </motion.div>

      {/* Main Content Area */}
      <div className="py-4 space-y-5">
        {/* Previous Session Found Card */}
        {hasActiveSavedSession && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-2xl bg-[#FEF08A] border-2 border-[var(--border-neo)] shadow-[3px_3px_0px_var(--border-neo)] flex items-center justify-between gap-2"
          >
            <div className="text-left">
              <span className="text-[10px] font-black text-[#18181B] block uppercase tracking-wider opacity-75">
                Active Session Detected
              </span>
              <span className="text-sm font-extrabold text-[#18181B] font-mono">
                Room {savedSession!.roomCode}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                onReconnect!(
                  savedSession!.roomCode!,
                  savedSession!.sessionToken!
                )
              }
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-[var(--surface-card)] text-[var(--text-primary)] text-xs font-black flex items-center gap-1.5 cursor-pointer border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] tactile-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rejoin Room</span>
            </button>
          </motion.div>
        )}

        {/* Error State Banner */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-2xl bg-[#FDA4AF] border-2 border-[var(--border-neo)] shadow-[3px_3px_0px_var(--border-neo)] text-[#18181B] text-xs font-black flex items-center justify-between gap-2"
          >
            <span>{errorMessage}</span>
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                className="p-1 hover:bg-black/10 rounded-lg cursor-pointer transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}

        {/* Server Disconnected or Connecting Banner */}
        {!connected && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-2.5 rounded-xl bg-[#FEF08A] border-2 border-[var(--border-neo)] text-[#18181B] text-xs font-bold text-center flex items-center justify-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>Connecting to game server...</span>
          </motion.div>
        )}

        {/* Primary Action Buttons */}
        <div className="space-y-3">
          <ActionButton
            variant="shared"
            onClick={onCreateRoom}
            loading={loading}
            loadingText="Creating Room..."
            icon={<Sparkles className="w-5 h-5 text-[#18181B]" />}
            subtext="Start a new room as host and invite friends"
          >
            Create New Room
          </ActionButton>

          <ActionButton
            variant="subtle"
            onClick={onNavigateToJoin}
            disabled={loading}
            icon={<LogIn className="w-5 h-5" />}
            subtext="Enter a 4-character room code to join friends"
          >
            Join Existing Room
          </ActionButton>
        </div>

        {/* Game Catalog Browser Section */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h2 className="text-base font-black text-[var(--text-primary)]">
                Game Collection
              </h2>
              <p className="text-xs font-bold opacity-60">
                Tap any card to view game rules and player counts
              </p>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] text-[var(--text-primary)] text-right leading-tight">
              {PLAYABLE_GAMES.length} playable
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PARTY_GAMES.map((game) => (
              <motion.div
                key={game.id}
                whileHover={{ y: -2, x: -1 }}
                whileTap={{ x: 2, y: 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                onClick={() => setPreviewGame(game)}
                className={`p-3.5 rounded-2xl border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)] bg-[var(--surface-card)] transition-colors cursor-pointer select-none flex flex-col justify-between active:shadow-[1px_1px_0px_var(--border-neo)] ${
                  game.comingSoon ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] text-[var(--text-primary)] flex items-center justify-center shrink-0">
                    <GameIcon icon={game.icon} size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-black text-sm text-[var(--text-primary)] truncate">
                        {game.title}
                      </h3>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold opacity-65 shrink-0">
                        <Users className="w-2.5 h-2.5" />
                        <span>{game.minPlayers}-{game.maxPlayers}</span>
                      </span>
                    </div>
                    <p className="text-[11px] font-bold opacity-60 truncate mt-0.5">
                      {game.tagline}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t-2 border-[var(--border-neo)] flex items-center justify-between">
                  {game.comingSoon ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-[#FDA4AF] text-[#18181B] px-1.5 py-0.5 rounded border border-[var(--border-neo)]">
                      <Clock3 className="w-3 h-3" />
                      Coming Soon
                    </span>
                  ) : (
                    <span className="text-[10px] font-black opacity-75 uppercase tracking-wider">
                      How to play
                    </span>
                  )}
                  <HelpCircle className="w-3.5 h-3.5 opacity-60" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="py-2 text-center">
        <p className="text-[11px] opacity-60 font-bold flex items-center justify-center gap-1">
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          <span>Mobile controllers • Zero app installation required</span>
        </p>
      </div>

      {/* "How to Play" Preview Modal */}
      <AnimatePresence>
        {previewGame && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#18181B]/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="p-6 rounded-3xl max-w-sm w-full bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[6px_6px_0px_var(--border-neo)] relative"
            >
              <button
                type="button"
                onClick={() => setPreviewGame(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] flex items-center justify-center font-black text-sm cursor-pointer tactile-btn"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-2xl border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-center shrink-0 transition-colors"
                  style={{ backgroundColor: getGameThemeColor(previewGame.id).bg }}
                >
                  <GameIcon icon={previewGame.icon} size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[var(--text-primary)] leading-tight">
                    {previewGame.title}
                  </h3>
                  <p className="text-xs font-bold opacity-60">
                    {previewGame.tagline}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] text-xs font-black mb-3">
                <Users className="w-3.5 h-3.5" />
                <span>Supports {previewGame.minPlayers}–{previewGame.maxPlayers} players</span>
              </div>

              <p className="text-xs font-semibold opacity-85 mb-4 leading-relaxed">
                {previewGame.description}
              </p>

              {previewGame.comingSoon && (
                <div className="mb-4 p-3 rounded-xl bg-[#FDA4AF] border-2 border-[var(--border-neo)] text-[11px] font-bold text-[#18181B] text-left flex items-start gap-2 shadow-[2px_2px_0px_var(--border-neo)]">
                  <Clock3 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Coming soon — this game is not playable yet. Any card without this badge
                    can be launched from the host's game select.
                  </span>
                </div>
              )}

              <div className="mb-5 p-3.5 rounded-2xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)]">
                <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-primary)] block mb-2.5 text-left">
                  Rules Breakdown
                </span>
                <ul className="text-xs space-y-2 text-left font-semibold">
                  {previewGame.rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#86EFAC] border border-[var(--border-neo)] flex items-center justify-center text-[10px] font-black shrink-0">
                        {idx + 1}
                      </span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setPreviewGame(null)}
                className="w-full py-3.5 rounded-2xl text-[#18181B] font-black text-sm cursor-pointer border-2 border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)] tactile-btn transition-colors"
                style={{ backgroundColor: getGameThemeColor(previewGame.id).bg }}
              >
                GOT IT, LET'S PLAY!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
