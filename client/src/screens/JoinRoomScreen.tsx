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
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Top Bar with Back Button */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between pb-2"
      >
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer transition-colors active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>

        <span className="text-xs font-bold text-neutral-400">Join Game Room</span>
      </motion.div>

      {/* Main Join Input Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="party-card p-6 rounded-3xl my-auto border border-[var(--border-subtle)] space-y-6"
      >
        <div className="text-center">
          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Enter Room Code
          </h2>
          <p className="text-xs font-semibold text-neutral-400 mt-1">
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
                className="block text-xs font-bold uppercase tracking-wider text-neutral-400 text-left"
              >
                Room Code
              </label>
              {isQrPrefilled && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
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
              className={`w-full text-center text-4xl sm:text-5xl font-black tracking-widest uppercase py-4 px-4 rounded-2xl border-2 transition-all ${
                errorMessage
                  ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-300 focus:border-red-500'
                  : 'border-[var(--border-subtle)] bg-neutral-50 dark:bg-neutral-900/60 text-[var(--text-primary)] focus:border-neutral-900 dark:focus:border-neutral-100'
              } focus:outline-none`}
              required
            />
          </motion.div>

          {/* Inline Danger-Color Error State */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-300 text-xs font-bold text-center"
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
        <p className="text-xs text-neutral-400 font-medium">
          Codes are 4 uppercase letters • Case-insensitive
        </p>
      </div>
    </div>
  );
}
