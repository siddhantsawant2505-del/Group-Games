import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Copy,
  Check,
  Play,
  UserPlus,
  Share2,
  QrCode,
  Settings2,
  TriangleAlert,
} from 'lucide-react';
import { RoomPublicState, Player, PlayMode } from '@shared/types';
import { getTeamStartReadiness } from '@shared/data/teams';
import { getTeamAccent } from '@shared/theme/tokens';
import { PlayerChip } from '../components/PlayerChip';
import { ActionButton } from '../components/ActionButton';
import { RoomQRCodeModal, InlineRoomQR } from '../components/RoomQRCode';
import { SettingsSheet } from '../components/SettingsSheet';
import { RoomSettingsPanel } from '../components/RoomSettingsPanel';

/** Room-wide settings actions owned by App and passed straight through. */
export interface RoomSettingsActions {
  onSetPlayMode: (mode: PlayMode) => void;
  onSetTeamCount: (count: number) => void;
  onJoinTeam: (teamId: string) => void;
  onRenameTeam: (teamId: string, name: string) => void;
  onBalanceTeams: (shuffle: boolean) => void;
  onSetRoundCount: (rounds: number) => void;
}

interface LobbyScreenProps {
  room: RoomPublicState;
  myPlayer: Player;
  onStartGame: () => void;
  onAddBot: () => void;
  roomSettings: RoomSettingsActions;
}

export function LobbyScreen({
  room,
  myPlayer,
  onStartGame,
  onAddBot,
  roomSettings,
}: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const isHost = myPlayer.isHost;
  const playerCount = room.players.length;
  // Solo keeps today's hard gate of 3 players; team mode adds its own rules.
  // Read the table limits from the selected game: Mafia needs 4, Top 100 needs 3.
  const minPlayers = room.selectedGame?.minPlayers ?? 3;
  const maxPlayers = room.selectedGame?.maxPlayers ?? 16;
  const readiness = getTeamStartReadiness(room.playMode, room.teams, playerCount, minPlayers);
  const canStart = room.playMode === 'team' ? readiness.ready : playerCount >= minPlayers;
  const myTeam = room.teams.find((team) => team.id === myPlayer.teamId);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLink = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my Party Game room: ${room.roomCode}`,
          text: `Join room code ${room.roomCode} on your phone!`,
          url,
        });
      } catch {
        copyCode();
      }
    } else {
      copyCode();
    }
  };

  const [isStarting, setIsStarting] = useState(false);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 max-w-md mx-auto w-full">
      {/* Top: Room Code Card */}
      <div>
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="party-card p-6 text-center rounded-3xl mb-5"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 block mb-1">
            Room Code
          </span>
          <div className="flex items-center justify-center gap-3 my-2">
            <span className="text-5xl sm:text-6xl font-black tracking-widest text-[var(--text-primary)] select-all font-mono">
              {room.roomCode}
            </span>
          </div>

          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-4">
            Tell friends to enter this code on their phones or scan the QR code
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-2xs"
              title="Display large QR code for camera scan"
            >
              <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>QR Code</span>
            </button>

            <button
              type="button"
              onClick={copyCode}
              className="px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Code Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-neutral-500" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={shareLink}
              className="px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <Share2 className="w-4 h-4 text-neutral-500" />
              <span>Share Link</span>
            </button>
          </div>

          {/* Quick Inline QR Scan card */}
          <div className="mt-4 pt-3.5 border-t border-[var(--border-subtle)] flex justify-center">
            <InlineRoomQR
              roomCode={room.roomCode}
              onOpenModal={() => setShowQrModal(true)}
            />
          </div>
        </motion.div>

        {/* Room QR Code Modal */}
        <RoomQRCodeModal
          roomCode={room.roomCode}
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
        />

        {/* Player List */}
        <div className="party-card p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-neutral-500" />
              <h2 className="font-extrabold text-base text-[var(--text-primary)]">
                Players in Room
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                  canStart
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                }`}
              >
                {playerCount} / {maxPlayers} Joined
              </span>

              {/* Room settings (play mode, teams, rounds) live behind this gear. */}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                title="Room settings — play mode, teams and rounds"
                aria-label="Room settings"
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Room mode summary: what the gear is currently set to */}
          <div className="mb-3">
            {room.playMode === 'solo' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                <Users className="w-3 h-3" />
                <span>Solo — everyone scores alone</span>
              </span>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {room.teams.map((team) => {
                    const accent = getTeamAccent(team.accentIndex);
                    const isMine = team.id === myTeam?.id;
                    return (
                      <span
                        key={team.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border"
                        style={{
                          borderColor: accent.hex,
                          backgroundColor: `${accent.hex}18`,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span aria-hidden="true">{team.icon}</span>
                        <span>{team.name}</span>
                        <span className="opacity-60">{team.memberIds.length}</span>
                        {isMine && <Check className="w-3 h-3" />}
                      </span>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 underline underline-offset-2 cursor-pointer"
                >
                  {myTeam ? `You are on ${myTeam.name} — change team or balance` : 'Pick your team'}
                </button>
                {readiness.sizeWarning && (
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-start gap-1.5" role="status">
                    <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{readiness.sizeWarning}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Chips grid */}
          <div className="flex flex-wrap gap-2.5">
            {room.players.map((p) => {
              const team = room.teams.find((entry) => entry.id === p.teamId);
              return (
                <PlayerChip
                  key={p.id}
                  name={p.name}
                  colorIndex={p.colorIndex}
                  isHost={p.isHost}
                  isYou={p.id === myPlayer.id}
                  connected={p.connected}
                  size="md"
                  badge={team ? `${team.icon} ${team.name}` : undefined}
                />
              );
            })}
          </div>

          {/* Host helper: add bot player for instant preview testing */}
          {isHost && playerCount < 6 && (
            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Testing solo in preview?
              </span>
              <button
                type="button"
                onClick={onAddBot}
                className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5 text-neutral-500" />
                <span>Add Test Player</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="pt-6">
        {isHost ? (
          <div>
            <ActionButton
              variant="shared"
              disabled={!canStart}
              loading={isStarting}
              loadingText="Launching Round..."
              onClick={() => {
                setIsStarting(true);
                onStartGame();
              }}
              icon={<Play className="w-5 h-5 fill-current" />}
              subtext={
                canStart
                  ? room.playMode === 'team'
                    ? `Choose game and start — teams: ${room.teams
                        .map((team) => `${team.icon} ${team.name}`)
                        .join(' vs ')}`
                    : 'Choose game and start round'
                  : room.playMode === 'team' && readiness.message
                  ? readiness.message
                  : `Need ${minPlayers - playerCount} more player${
                      minPlayers - playerCount === 1 ? '' : 's'
                    } to start (min ${minPlayers})`
              }
            >
              Start Game
            </ActionButton>
          </div>
        ) : (
          <div className="party-card p-4 rounded-2xl text-center">
            <span className="text-sm font-bold text-neutral-600 dark:text-neutral-300 flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              Waiting for host to start the game...
            </span>
          </div>
        )}
      </div>

      {/* Room settings sheet — the gear above the player list opens this */}
      <SettingsSheet
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Room settings"
        subtitle={
          isHost
            ? 'Play mode, teams and rounds'
            : room.playMode === 'team'
            ? 'Tap a team below to join it'
            : 'Set by the host'
        }
      >
        <RoomSettingsPanel room={room} myPlayer={myPlayer} {...roomSettings} />
      </SettingsSheet>
    </div>
  );
}
