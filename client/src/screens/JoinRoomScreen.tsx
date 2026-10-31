import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, QrCode } from 'lucide-react';
import { ActionButton } from '../components/ActionButton';
import { playNotificationSound, triggerHaptic } from '../services/sound';

interface JoinRoomScreenProps {
  onJoinRoom: (roomCode: string) => void;
  onBack: () => void;
  loading?: boolean;
  errorMessage?: string | null;
}

export function JoinRoomScreen({
  onJoinRoom,
  onBack,
  loading = false,
  errorMessage = null,
}: JoinRoomScreenProps) {
  const [code, setCode] = useState('');
  const [shake, setShake] = useState(false);
  const [isQrPrefilled, setIsQrPrefilled] = useState(false);

  // Auto-detect code from URL query parameter (e.g. ?room=ABCD from QR code)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlCode = searchParams.get('room') || searchParams.get('code');
      if (urlCode && urlCode.trim().length === 4) {
        setCode(urlCode.trim().toUpperCase());
        setIsQrPrefilled(true);
      }
    }
  }, []);

  // Trigger shake animation and sound when an error message arrives from the server
  useEffect(() => {
    if (errorMessage) {
      setShake(true);
      playNotificationSound('timer-warning');
      triggerHaptic('double');
      const timer = setTimeout(() => setShake(false), 600);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 4) {
      setShake(true);
      playNotificationSound('timer-warning');
      triggerHaptic('double');
      setTimeout(() => setShake(false), 600);
      return;
    }
    onJoinRoom(cleanCode);
  };

  const isCodeComplete = code.trim().length === 4;

  return (
    <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
      {/* Top Bar with Back Button */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between pb-2 border-b-2 border-[var(--border-neo)]"
      >
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-card)] text-xs font-black border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] cursor-pointer tactile-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>

        <span className="text-xs font-black uppercase tracking-wider opacity-65">
          Join Game Room
        </span>
      </motion.div>

      {/* Main Join Input Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-3xl my-auto bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[6px_6px_0px_var(--border-neo)] space-y-6"
      >
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#93C5FD] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] flex items-center justify-center mx-auto mb-3 text-2xl font-black">
            🔑
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Enter Room Code
          </h2>
          <p className="text-xs font-bold opacity-60 mt-1">
            Ask the host for the 4-letter room code on their screen
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div
            animate={
              shake
                ? {
                    x: [-12, 12, -10, 10, -5, 5, 0],
                  }
                : {}
            }
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="join-room-code-input"
                className="block text-xs font-black uppercase tracking-wider opacity-75 text-left"
              >
                Room PIN
              </label>
              {isQrPrefilled && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#18181B] bg-[#86EFAC] px-2 py-0.5 rounded-md border border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)]">
                  <QrCode className="w-3 h-3" />
                  <span>From QR code</span>
                </span>
              )}
            </div>

            <input
              id="join-room-code-input"
              type="text"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
              className={`w-full text-center text-4xl sm:text-5xl font-black font-mono tracking-[0.3em] uppercase py-4 px-4 rounded-2xl border-[2.5px] transition-all bg-[var(--surface-card-subtle)] ${
                errorMessage
                  ? 'border-[#FDA4AF] bg-[#FDA4AF]/20 text-[#18181B] shadow-[3px_3px_0px_#FDA4AF]'
                  : 'border-[var(--border-neo)] text-[var(--text-primary)] focus:shadow-[4px_4px_0px_var(--border-neo)] focus:-translate-y-0.5'
              } focus:outline-none`}
              required
            />
          </motion.div>

          {/* Inline Danger-Color Error State */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-[#FDA4AF] border-2 border-[var(--border-neo)] text-[#18181B] text-xs font-black text-center shadow-[2px_2px_0px_var(--border-neo)]"
            >
              {errorMessage}
            </motion.div>
          )}

          <div className="pt-2">
            <ActionButton
              type="submit"
              variant="shared"
              loading={loading}
              loadingText="Entering Room..."
              disabled={loading || !isCodeComplete}
              icon={<ArrowRight className="w-5 h-5" />}
            >
              Enter Room
            </ActionButton>
          </div>
        </form>
      </motion.div>

      {/* Footer Info */}
      <div className="py-3 text-center">
        <p className="text-xs opacity-60 font-bold">
          Codes are 4 uppercase letters • Case-insensitive
        </p>
      </div>
    </div>
  );
}
