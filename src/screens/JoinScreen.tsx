import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, RotateCcw, Smartphone, QrCode } from 'lucide-react';
import { ActionButton } from '../components/ActionButton';
import { PLAYER_COLORS } from '../theme/tokens';

interface JoinScreenProps {
  onCreateRoom: (hostName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onReconnect: (roomCode: string, sessionToken: string) => void;
  savedSession: {
    roomCode: string | null;
    playerId: string | null;
    sessionToken: string | null;
    playerName: string | null;
  } | null;
  loading: boolean;
  errorMessage?: string | null;
}

export function JoinScreen({
  onCreateRoom,
  onJoinRoom,
  onReconnect,
  savedSession,
  loading,
  errorMessage,
}: JoinScreenProps) {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState(savedSession?.playerName || '');
  const [isQrJoin, setIsQrJoin] = useState(false);

  // Auto-detect room code from URL query parameter (e.g. ?room=ABCD from QR code scan)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlCode = searchParams.get('room') || searchParams.get('code');
      if (urlCode && urlCode.trim().length === 4) {
        setRoomCode(urlCode.trim().toUpperCase());
        setMode('join');
        setIsQrJoin(true);
      }
    }
  }, []);

  const hasActiveSavedSession = Boolean(
    savedSession?.roomCode && savedSession?.sessionToken
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    if (mode === 'create') {
      onCreateRoom(playerName.trim());
    } else {
      if (!roomCode.trim()) return;
      onJoinRoom(roomCode.trim().toUpperCase(), playerName.trim());
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Top Banner / Genre identity */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-4 pb-2"
      >
        {/* Playful Player Color Dots Showcase */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {PLAYER_COLORS.map((col, i) => (
            <motion.div
              key={col.hex}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.06, type: 'spring' }}
              className="w-4 h-4 rounded-full shadow-xs"
              style={{ backgroundColor: col.hex }}
            />
          ))}
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none text-[var(--text-primary)]">
          Party Games
        </h1>
        <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mt-2 flex items-center justify-center gap-1.5">
          <Smartphone className="w-4 h-4 text-emerald-500" />
          <span>Every player joins from their phone</span>
        </p>
      </motion.div>

      {/* Main Action Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="party-card p-6 rounded-3xl my-auto"
      >
        {/* Reconnect Banner if previous room exists */}
        {hasActiveSavedSession && (
          <div className="mb-5 p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-[var(--border-subtle)] flex items-center justify-between gap-2">
            <div className="text-left">
              <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 block uppercase tracking-wider">
                Previous Session Found
              </span>
              <span className="text-sm font-extrabold text-[var(--text-primary)]">
                Room {savedSession!.roomCode}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                onReconnect(
                  savedSession!.roomCode!,
                  savedSession!.sessionToken!
                )
              }
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rejoin</span>
            </button>
          </div>
        )}

        {/* Tab switch: Join Room vs Create Room */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-5">
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              mode === 'join'
                ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-[var(--text-primary)]'
            }`}
          >
            Join Room
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              mode === 'create'
                ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-[var(--text-primary)]'
            }`}
          >
            Create Room
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'join' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 text-left">
                  4-Character Room Code
                </label>
                {isQrJoin && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <QrCode className="w-3 h-3" />
                    <span>Auto-filled from QR</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
                className="w-full text-center text-3xl font-black tracking-widest uppercase py-3.5 px-4 rounded-2xl border-2 border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 text-left">
              Your Nickname
            </label>
            <input
              type="text"
              maxLength={15}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Alex"
              autoComplete="name"
              className="w-full py-3.5 px-4 rounded-2xl border border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-[var(--text-primary)] font-bold text-base focus:border-neutral-900 dark:focus:border-neutral-100 focus:outline-none transition-colors"
              required
            />
          </div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 text-xs font-semibold text-left"
            >
              {errorMessage}
            </motion.div>
          )}

          <div className="pt-2">
            <ActionButton
              type="submit"
              variant="shared"
              loading={loading}
              loadingText={mode === 'create' ? 'Creating Room...' : 'Joining Room...'}
              disabled={
                loading ||
                !playerName.trim() ||
                (mode === 'join' && roomCode.trim().length !== 4)
              }
              icon={
                mode === 'create' ? (
                  <Sparkles className="w-5 h-5" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )
              }
            >
              {mode === 'create' ? 'Create New Game Room' : 'Enter Game Room'}
            </ActionButton>
          </div>
        </form>
      </motion.div>

      {/* Footer info */}
      <div className="py-4 text-center">
        <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
          No TV or shared monitor needed • Instant phone-to-phone sync
        </p>
      </div>
    </div>
  );
}
