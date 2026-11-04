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
  onRemovePlayer?: (playerId: string) => void;
  roomSettings: RoomSettingsActions;
}

export function LobbyScreen({
  room,
  myPlayer,
  onStartGame,
  onAddBot,
  onRemovePlayer,
  roomSettings,
}: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const isHost = myPlayer.isHost;
  const playerCount = room.players.length;

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
    <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
      {/* Top: Room Code Card */}
      <div>
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-6 text-center rounded-3xl mb-5 bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[6px_6px_0px_var(--border-neo)]"
        >
          <span className="text-xs font-black uppercase tracking-widest opacity-60 block mb-1">
            Room Code
          </span>
          <div className="flex items-center justify-center gap-3 my-1">
            <span className="text-5xl sm:text-6xl font-black font-mono tracking-[0.2em] text-[var(--text-primary)] select-all">
              {room.roomCode}
            </span>
          </div>

          <p className="text-xs font-bold opacity-60 mb-4">
            Tell friends to enter this code on their phones or scan the QR code
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#86EFAC] text-[#18181B] text-xs font-black flex items-center gap-1.5 cursor-pointer border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] tactile-btn"
              title="Display large QR code for camera scan"
            >
              <QrCode className="w-4 h-4" />
              <span>QR Code</span>
            </button>

            <button
              type="button"
              onClick={copyCode}
              className="px-3.5 py-2 rounded-xl bg-[#FEF08A] text-[#18181B] text-xs font-black flex items-center gap-1.5 cursor-pointer border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] tactile-btn"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy PIN</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={shareLink}
              className="px-3.5 py-2 rounded-xl bg-[#93C5FD] text-[#18181B] text-xs font-black flex items-center gap-1.5 cursor-pointer border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] tactile-btn"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Link</span>
            </button>
          </div>

          {/* Quick Inline QR Scan card */}
          <div className="mt-4 pt-3.5 border-t-2 border-[var(--border-neo)] flex justify-center">
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

        {/* Player List Roster */}
        <div className="p-5 rounded-3xl bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--text-primary)]" />
              <h2 className="font-black text-base text-[var(--text-primary)]">
                Party Roster
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-xl text-xs font-black border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] ${
                  canStart
                    ? 'bg-[#86EFAC] text-[#18181B]'
                    : 'bg-[#FEF08A] text-[#18181B]'
                }`}
              >
                {playerCount} / {maxPlayers} Joined
              </span>

              {/* Room settings gear */}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                title="Room settings — play mode, teams and rounds"
                aria-label="Room settings"
                className="w-8 h-8 rounded-xl bg-[var(--surface-card-subtle)] text-[var(--text-primary)] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] flex items-center justify-center cursor-pointer tactile-btn"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Room mode summary */}
          <div className="mb-3">
            {room.playMode === 'solo' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] text-[var(--text-primary)]">
                <Users className="w-3.5 h-3.5" />
                <span>Solo Mode — Individual Scoring</span>
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
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)]"
                        style={{
                          backgroundColor: `${accent.hex}33`,
                          color: '#18181B',
                        }}
                      >
                        <span aria-hidden="true">{team.icon}</span>
                        <span>{team.name}</span>
                        <span className="opacity-70 font-mono">({team.memberIds.length})</span>
                        {isMine && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="text-[11px] font-extrabold text-[var(--text-primary)] underline underline-offset-4 cursor-pointer"
                >
                  {myTeam ? `You are on ${myTeam.name} — change team` : 'Pick your team'}
                </button>
                {readiness.sizeWarning && (
                  <p className="text-[11px] font-bold text-amber-700 bg-amber-100 p-2 rounded-xl border border-[var(--border-neo)] flex items-start gap-1.5" role="status">
                    <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{readiness.sizeWarning}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Chips grid in recessed container */}
          <div className="p-3 rounded-2xl neo-trough">
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
                    onRemove={
                      isHost && p.id !== myPlayer.id && onRemovePlayer
                        ? () => onRemovePlayer(p.id)
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>

          {/* Host helper: add bot player */}
          {isHost && playerCount < 6 && (
            <div className="mt-4 pt-3 border-t-2 border-[var(--border-neo)] flex items-center justify-between">
              <span className="text-xs font-bold opacity-60">
                Testing solo in preview?
              </span>
              <button
                type="button"
                onClick={onAddBot}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface-card-subtle)] text-xs font-black text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] tactile-btn"
              >
                <UserPlus className="w-3.5 h-3.5" />
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
                    ? `Start round — teams: ${room.teams
                        .map((team) => `${team.icon} ${team.name}`)
                        .join(' vs ')}`
                    : 'Launch party game'
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
          <div className="p-4 rounded-2xl text-center bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[4px_4px_0px_var(--border-neo)]">
            <span className="text-sm font-black text-[var(--text-primary)] flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#86EFAC] border border-[var(--border-neo)] animate-ping" />
              Waiting for host to start the game...
            </span>
          </div>
        )}
      </div>

      {/* Room settings sheet */}
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
