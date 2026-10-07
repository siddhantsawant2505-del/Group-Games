import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, LogIn, Users, X, RotateCcw, Smartphone, HelpCircle } from 'lucide-react';
import { PARTY_GAMES } from '@shared/data/games';
import { GameMetadata } from '@shared/types';
import { PLAYER_COLORS } from '@shared/theme/tokens';
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
}: HomeScreenProps) {
  const [previewGame, setPreviewGame] = useState<GameMetadata | null>(null);

  const colorToken = PLAYER_COLORS[playerColorIndex] || PLAYER_COLORS[0];
  const hasActiveSavedSession = Boolean(
    savedSession?.roomCode && savedSession?.sessionToken && onReconnect
  );

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Top Bar with Brand & Player Avatar Chip */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]"
      >
        <div>
          <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)] leading-tight">
            Party Games
          </h1>
          <p className="text-[11px] font-bold text-neutral-400">
            Real-time phone party engine
          </p>
        </div>

        {/* Small corner Player Avatar Chip - clickable to edit profile */}
        <button
          type="button"
          onClick={onEditProfile}
          title="Edit Profile"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700/80 border border-[var(--border-subtle)] transition-all cursor-pointer active:scale-95"
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
            className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-[var(--border-subtle)] flex items-center justify-between gap-2 shadow-xs"
          >
            <div className="text-left">
              <span className="text-[10px] font-black text-neutral-400 block uppercase tracking-wider">
                Active Session Detected
              </span>
              <span className="text-sm font-black text-[var(--text-primary)]">
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
              className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-black flex items-center gap-1.5 cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rejoin Room</span>
            </button>
          </motion.div>
        )}

        {/* Primary Action Buttons */}
        <div className="space-y-3">
          <ActionButton
            variant="shared"
            onClick={onCreateRoom}
            loading={loading}
            loadingText="Creating Room..."
            icon={<Sparkles className="w-5 h-5 text-amber-400" />}
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
              <p className="text-xs font-semibold text-neutral-400">
                Tap any card to view game rules and player counts
              </p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
              {PARTY_GAMES.length} games
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PARTY_GAMES.map((game) => (
              <motion.div
                key={game.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setPreviewGame(game)}
                className="party-card p-3.5 rounded-2xl border border-[var(--border-subtle)] hover:border-neutral-400 dark:hover:border-neutral-600 transition-all cursor-pointer select-none flex flex-col justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 flex items-center justify-center shrink-0">
                    <GameIcon icon={game.icon} size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-extrabold text-sm text-[var(--text-primary)] truncate">
                        {game.title}
                      </h3>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-neutral-400 shrink-0">
                        <Users className="w-2.5 h-2.5" />
                        <span>{game.minPlayers}-{game.maxPlayers}</span>
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-neutral-400 truncate mt-0.5">
                      {game.tagline}
                    </p>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    How to play
                  </span>
                  <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="py-2 text-center">
        <p className="text-[11px] text-neutral-400 font-medium flex items-center justify-center gap-1">
          <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
          <span>Mobile controllers • No extra app download required</span>
        </p>
      </div>

      {/* "How to Play" Preview Modal */}
      <AnimatePresence>
        {previewGame && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="party-card p-6 rounded-3xl max-w-sm w-full border border-[var(--border-subtle)] shadow-xl relative"
            >
              <button
                type="button"
                onClick={() => setPreviewGame(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 flex items-center justify-center shrink-0">
                  <GameIcon icon={previewGame.icon} size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[var(--text-primary)] leading-tight">
                    {previewGame.title}
                  </h3>
                  <p className="text-xs font-bold text-neutral-400">
                    {previewGame.tagline}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-3">
                <Users className="w-3 h-3" />
                <span>Supports {previewGame.minPlayers}–{previewGame.maxPlayers} players</span>
              </div>

              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">
                {previewGame.description}
              </p>

              <div className="mb-5 p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-[var(--border-subtle)]">
                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-2 text-left">
                  Rules Breakdown
                </span>
                <ul className="text-xs space-y-2 text-neutral-600 dark:text-neutral-300 text-left">
                  {previewGame.rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 shrink-0 mt-1.5" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[11px] font-semibold text-amber-800 dark:text-amber-200 mb-4 text-left">
                💡 The host selects the active game after launching the room!
              </div>

              <button
                type="button"
                onClick={() => setPreviewGame(null)}
                className="w-full py-3 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-black text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-xs"
              >
                Got It
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
