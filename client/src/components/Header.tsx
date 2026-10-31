import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Copy, Check, LogOut, Volume2, VolumeX } from 'lucide-react';
import { Player } from '@shared/types';
import { getPlayerColor } from '@shared/theme/tokens';
import { isSoundEnabled, toggleSound, subscribeSoundChange } from '../services/sound';
import { PlayerAvatar } from './PlayerAvatar';

interface HeaderProps {
  roomCode?: string;
  myPlayer?: Player | null;
  connected: boolean;
  onLeaveRoom?: () => void;
}

export function Header({
  roomCode,
  myPlayer,
  connected,
  onLeaveRoom,
}: HeaderProps) {
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  useEffect(() => {
    // Subscribe to global sound setting changes
    const unsubscribe = subscribeSoundChange((enabled) => {
      setSoundOn(enabled);
    });
    return unsubscribe;
  }, []);

  const handleToggleSound = () => {
    const newState = toggleSound();
    setSoundOn(newState);
  };

  const copyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const playerColor = myPlayer ? getPlayerColor(myPlayer.colorIndex) : null;

  return (
    <header className="w-full px-4 py-2.5 flex items-center justify-between border-b-[2.5px] border-[var(--border-neo)] bg-[var(--surface-card)] shadow-[0px_4px_0px_var(--border-neo)] sticky top-0 z-30 select-none">
      {/* Left: Brand or Room Code Pill */}
      <div className="flex items-center gap-2">
        {roomCode ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black tracking-wider cursor-pointer tactile-btn"
              title="Tap to copy room code"
            >
              <span className="text-[10px] font-bold opacity-75">
                PIN:
              </span>
              <span className="text-base font-extrabold tracking-widest font-mono text-[var(--text-primary)]">
                {roomCode}
              </span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 opacity-60" />
              )}
            </button>
            {copied && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#FEF08A] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] animate-bounce">
                COPIED!
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#86EFAC] border-2 border-[var(--border-neo)] animate-pulse" />
            <span className="font-extrabold text-lg tracking-tight text-[var(--text-primary)]">
              Party Games
            </span>
          </div>
        )}
      </div>

      {/* Right: Player avatar, connection dot, theme toggle, leave button */}
      <div className="flex items-center gap-2">
        {/* Connection status indicator */}
        <span
          title={connected ? 'Real-time sync active' : 'Disconnected'}
          className={`flex items-center justify-center p-1.5 rounded-xl border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] ${
            connected
              ? 'bg-[#86EFAC] text-[#18181B]'
              : 'bg-[#FDA4AF] text-[#18181B] animate-pulse'
          }`}
        >
          {connected ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
        </span>

        {/* Sound & Haptics toggle */}
        <button
          type="button"
          onClick={handleToggleSound}
          className={`p-1.5 rounded-xl border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] tactile-btn cursor-pointer ${
            soundOn
              ? 'bg-[var(--surface-card)] text-[var(--text-primary)]'
              : 'bg-[#FDA4AF] text-[#18181B]'
          }`}
          title={
            soundOn
              ? 'Mute game notifications and haptic feedback'
              : 'Unmute game notifications and haptic feedback'
          }
          aria-label={
            soundOn
              ? 'Mute game notifications and haptics'
              : 'Unmute game notifications and haptics'
          }
        >
          {soundOn ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>

        {/* Current Player badge if in a room */}
        {myPlayer && playerColor && (
          <div
            className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-xl text-xs font-black border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)]"
            style={{
              backgroundColor: playerColor.hex,
              color: playerColor.contrastText,
            }}
          >
            <PlayerAvatar
              name={myPlayer.name}
              colorIndex={myPlayer.colorIndex}
              size="xs"
              connected={connected}
            />
            <span className="max-w-[70px] truncate">{myPlayer.name}</span>
          </div>
        )}

        {/* Leave room */}
        {roomCode && onLeaveRoom && (
          <button
            type="button"
            onClick={onLeaveRoom}
            className="p-1.5 rounded-xl border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] bg-[#FDA4AF] text-[#18181B] tactile-btn cursor-pointer"
            title="Leave room"
            aria-label="Leave room"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
