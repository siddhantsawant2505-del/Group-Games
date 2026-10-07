import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Moon, Sun, Copy, Check, LogOut, Volume2, VolumeX } from 'lucide-react';
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
  const [isDark, setIsDark] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  useEffect(() => {
    // Subscribe to global sound setting changes
    const unsubscribe = subscribeSoundChange((enabled) => {
      setSoundOn(enabled);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Check current theme
    const theme = document.documentElement.getAttribute('data-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(theme === 'dark' || (!theme && prefersDark));
  }, []);

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

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
    <header className="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-card)] sticky top-0 z-30 select-none">
      {/* Left: Brand or Room Code */}
      <div className="flex items-center gap-2">
        {roomCode ? (
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold tracking-wider cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            title="Tap to copy room code"
          >
            <span className="text-neutral-500 dark:text-neutral-400 font-medium">
              ROOM
            </span>
            <span className="text-base font-extrabold tracking-widest text-[var(--text-primary)]">
              {roomCode}
            </span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-neutral-400" />
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#FF5A5F]" />
            <span className="font-extrabold text-lg tracking-tight">Party Games</span>
          </div>
        )}
      </div>

      {/* Right: Player avatar, connection dot, theme toggle, leave button */}
      <div className="flex items-center gap-2">
        {/* Connection status indicator */}
        <span
          title={connected ? 'Real-time sync active' : 'Disconnected'}
          className={`flex items-center justify-center p-1.5 rounded-lg ${
            connected
              ? 'text-emerald-500'
              : 'text-red-500 bg-red-50 dark:bg-red-950/40'
          }`}
        >
          {connected ? (
            <Wifi className="w-4 h-4" />
          ) : (
            <WifiOff className="w-4 h-4 animate-pulse" />
          )}
        </span>

        {/* Sound & Haptics toggle */}
        <button
          type="button"
          onClick={handleToggleSound}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${
            soundOn
              ? 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              : 'text-red-500 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50'
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

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          title="Toggle color theme"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Current Player badge if in a room */}
        {myPlayer && playerColor && (
          <div
            className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-xs font-bold"
            style={{
              backgroundColor: `${playerColor.hex}22`,
              border: `1.5px solid ${playerColor.hex}`,
              color: 'var(--text-primary)',
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
            className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
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
