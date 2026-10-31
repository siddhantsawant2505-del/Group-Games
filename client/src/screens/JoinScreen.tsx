import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, RotateCcw, Smartphone, QrCode } from 'lucide-react';
import { ActionButton } from '../components/ActionButton';
import { PLAYER_COLORS } from '@shared/theme/tokens';

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
    <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
      {/* Top Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-3 pb-2"
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          {PLAYER_COLORS.map((col, i) => (
            <motion.div
              key={col.hex}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05, type: 'spring' }}
              className="w-4 h-4 rounded-full border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)]"
              style={{ backgroundColor: col.hex }}
            />
          ))}
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none text-[var(--text-primary)]">
          Party Games
        </h1>
        <p className="text-xs font-bold opacity-60 mt-2 flex items-center justify-center gap-1.5">
          <Smartphone className="w-4 h-4 text-emerald-600" />
          <span>Every player joins from their phone</span>
        </p>
      </motion.div>

      {/* Main Action Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-3xl my-auto bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[6px_6px_0px_var(--border-neo)] space-y-5"
      >
        {/* Reconnect Banner */}
        {hasActiveSavedSession && (
          <div className="p-3.5 rounded-2xl bg-[#FEF08A] border-2 border-[var(--border-neo)] shadow-[3px_3px_0px_var(--border-neo)] flex items-center justify-between gap-2">
            <div className="text-left">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-75 block">
                Previous Session Found
              </span>
              <span className="text-sm font-black font-mono text-[#18181B]">
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
              className="px-3.5 py-2 rounded-xl bg-[var(--surface-card)] text-[var(--text-primary)] text-xs font-black flex items-center gap-1.5 cursor-pointer border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] tactile-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rejoin</span>
            </button>
          </div>
        )}

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)]">
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer ${
              mode === 'join'
                ? 'bg-[#FEF08A] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] -translate-y-0.5'
                : 'opacity-65 hover:opacity-100'
            }`}
          >
            Join Room
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer ${
              mode === 'create'
                ? 'bg-[#FEF08A] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] -translate-y-0.5'
                : 'opacity-65 hover:opacity-100'
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
                <label className="block text-xs font-black uppercase tracking-wider opacity-65 text-left">
                  4-Character Room Code
                </label>
                {isQrJoin && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#18181B] bg-[#86EFAC] px-2 py-0.5 rounded-md border border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)]">
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
                className="w-full text-center text-3xl font-black font-mono tracking-[0.3em] uppercase py-3.5 px-4 rounded-2xl border-[2.5px] border-[var(--border-neo)] bg-[var(--surface-card-subtle)] text-[var(--text-primary)] focus:shadow-[4px_4px_0px_var(--border-neo)] focus:-translate-y-0.5 focus:outline-none transition-all"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase tracking-wider opacity-65 mb-1.5 text-left">
              Your Nickname
            </label>
            <input
              type="text"
              maxLength={15}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Alex"
              autoComplete="name"
              className="w-full py-3.5 px-4 rounded-2xl border-[2.5px] border-[var(--border-neo)] bg-[var(--surface-card-subtle)] text-[var(--text-primary)] font-black text-base focus:shadow-[4px_4px_0px_var(--border-neo)] focus:-translate-y-0.5 focus:outline-none transition-all"
              required
            />
          </div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-[#FDA4AF] border-2 border-[var(--border-neo)] text-[#18181B] text-xs font-black text-left shadow-[2px_2px_0px_var(--border-neo)]"
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
        <p className="text-xs opacity-60 font-bold">
          No TV or shared monitor needed • Instant phone-to-phone sync
        </p>
      </div>
    </div>
  );
}
