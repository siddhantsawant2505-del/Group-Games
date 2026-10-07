/**
 * Party Games Foundation: Main Application Component.
 * Mobile-first architecture, real-time WebSocket sync, and round-phase framework.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getSocket,
  saveSession,
  loadSession,
  clearSession,
  loadUserProfile,
} from './services/socket';
import { playNotificationSound, triggerHaptic } from './services/sound';
import { RoomPublicState, Player, PlayerPrivateState, GamePhase } from '@shared/types';
import { Header } from './components/Header';
import { LoadingScreen } from './screens/LoadingScreen';
import { NameEntryScreen } from './screens/NameEntryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { JoinRoomScreen } from './screens/JoinRoomScreen';
import { PostGameScreen } from './screens/PostGameScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameSelectScreen } from './screens/GameSelectScreen';
import { RevealPhaseScreen } from './screens/RevealPhaseScreen';
import { InputPhaseScreen } from './screens/InputPhaseScreen';
import { RevealAnswersScreen } from './screens/RevealAnswersScreen';
import { DiscussionPhaseScreen } from './screens/DiscussionPhaseScreen';
import { VotePhaseScreen } from './screens/VotePhaseScreen';
import { ResultsPhaseScreen } from './screens/ResultsPhaseScreen';

type PreRoomScreen = 'loading' | 'name-entry' | 'home' | 'join-room';

export default function App() {
  const [preRoomScreen, setPreRoomScreen] = useState<PreRoomScreen>('loading');
  const [userProfile, setUserProfile] = useState<{
    name: string;
    colorIndex: number;
  } | null>(loadUserProfile());

  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [privateState, setPrivateState] = useState<PlayerPrivateState>({});
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedSession, setSavedSession] = useState<{
    roomCode: string | null;
    playerId: string | null;
    sessionToken: string | null;
    playerName: string | null;
  } | null>(loadSession());

  // Socket connection and listener management
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      setConnected(true);
      // Auto-reconnect if we have an active room or a saved session
      const session = loadSession();
      const targetRoomCode = room?.roomCode || session.roomCode;
      const targetPlayerName = myPlayer?.name || session.playerName || '';
      const targetToken = myPlayer?.sessionToken || session.sessionToken;

      if (targetRoomCode && (targetToken || targetPlayerName)) {
        socket.emit(
          'reconnect',
          {
            roomCode: targetRoomCode,
            playerName: targetPlayerName,
            sessionToken: targetToken,
          },
          (res: any) => {
            if (res?.success) {
              setRoom(res.room);
              setMyPlayer(res.player);
              if (res.privateState) setPrivateState(res.privateState);
              saveSession(
                res.room.roomCode,
                res.player.id,
                res.player.sessionToken,
                res.player.name
              );
            } else if (!room) {
              clearSession();
              setSavedSession(null);
            }
          }
        );
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleRoomUpdate = (updatedRoom: RoomPublicState) => {
      setRoom((prev) => {
        if (prev && prev.phase !== updatedRoom.phase) {
          playNotificationSound('phase-change');
          triggerHaptic('medium');
        }
        return updatedRoom;
      });
      // Sync myPlayer info if updated
      setMyPlayer((current) => {
        if (!current) return null;
        const matching = updatedRoom.players.find((p) => p.id === current.id);
        return matching || current;
      });
    };

    const handlePrivateState = (updatedPrivateState: PlayerPrivateState) => {
      setPrivateState(updatedPrivateState);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room:update', handleRoomUpdate);
    socket.on('player:private-state', handlePrivateState);

    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room:update', handleRoomUpdate);
      socket.off('player:private-state', handlePrivateState);
    };
  }, [room]);

  // Host creates a new room
  const handleCreateRoom = useCallback(
    (hostName: string, colorIndex?: number) => {
      setLoading(true);
      setErrorMessage(null);
      const socket = getSocket();

      socket.emit('create-room', { hostName, colorIndex }, (res: any) => {
        setLoading(false);
        if (res?.success) {
          setRoom(res.room);
          setMyPlayer(res.player);
          if (res.privateState) setPrivateState(res.privateState);
          saveSession(
            res.room.roomCode,
            res.player.id,
            res.player.sessionToken,
            res.player.name
          );
        } else {
          setErrorMessage(res?.error || 'Failed to create room. Please retry.');
        }
      });
    },
    []
  );

  // Player joins room
  const handleJoinRoom = useCallback(
    (roomCode: string, playerName: string, colorIndex?: number) => {
      setLoading(true);
      setErrorMessage(null);
      const socket = getSocket();

      socket.emit(
        'join-room',
        {
          roomCode,
          playerName,
          sessionToken: null,
          colorIndex,
        },
        (res: any) => {
          setLoading(false);
          if (res?.success) {
            setRoom(res.room);
            setMyPlayer(res.player);
            if (res.privateState) setPrivateState(res.privateState);
            saveSession(
              res.room.roomCode,
              res.player.id,
              res.player.sessionToken,
              res.player.name
            );
          } else {
            setErrorMessage(res?.error || 'Could not join room. Please check the code.');
          }
        }
      );
    },
    []
  );

  // Reconnect using saved session
  const handleReconnect = useCallback((roomCode: string, sessionToken: string) => {
    setLoading(true);
    setErrorMessage(null);
    const socket = getSocket();

    socket.emit(
      'join-room',
      {
        roomCode,
        playerName: savedSession?.playerName || userProfile?.name || '',
        sessionToken,
        colorIndex: userProfile?.colorIndex,
      },
      (res: any) => {
        setLoading(false);
        if (res?.success) {
          setRoom(res.room);
          setMyPlayer(res.player);
          if (res.privateState) setPrivateState(res.privateState);
        } else {
          setErrorMessage(res?.error || 'Could not rejoin room.');
          clearSession();
          setSavedSession(null);
        }
      }
    );
  }, [savedSession, userProfile]);

  // Host adds a test player / bot for preview testing
  const handleAddBot = useCallback(() => {
    if (!room) return;
    const socket = getSocket();
    socket.emit('add-bot', { roomCode: room.roomCode });
  }, [room]);

  // Host selects game
  const handleSelectGame = useCallback((gameId: string) => {
    if (!room) return;
    const socket = getSocket();
    socket.emit('select-game', { roomCode: room.roomCode, gameId });
  }, [room]);

  // Host moves to game-select phase
  const handleGoToGameSelect = useCallback(() => {
    if (!room) return;
    const socket = getSocket();
    socket.emit('advance-phase', {
      roomCode: room.roomCode,
      targetPhase: 'game-select',
    });
  }, [room]);

  // Host confirms game and begins round
  const handleConfirmAndStartRound = useCallback(() => {
    if (!room) return;
    const socket = getSocket();
    socket.emit('advance-phase', {
      roomCode: room.roomCode,
      targetPhase: 'reveal',
    });
  }, [room]);

  // Host advances phase manually
  const handleAdvancePhase = useCallback((targetPhase?: GamePhase) => {
    if (!room) return;
    const socket = getSocket();
    socket.emit('advance-phase', {
      roomCode: room.roomCode,
      targetPhase,
    });
  }, [room]);

  // Player submits input response
  const handleSubmitAnswer = useCallback((answer: string) => {
    if (!room || !myPlayer) return;
    playNotificationSound('submit-lock');
    triggerHaptic('success');
    const socket = getSocket();
    socket.emit('submit-input', {
      roomCode: room.roomCode,
      playerId: myPlayer.id,
      answer,
    });
  }, [room, myPlayer]);

  // Player casts vote
  const handleCastVote = useCallback((targetPlayerId: string) => {
    if (!room || !myPlayer) return;
    playNotificationSound('submit-lock');
    triggerHaptic('heavy');
    const socket = getSocket();
    socket.emit('cast-vote', {
      roomCode: room.roomCode,
      voterId: myPlayer.id,
      targetPlayerId,
    });
  }, [room, myPlayer]);

  // Return to lobby
  const handleReturnToLobby = useCallback(() => {
    if (!room) return;
    const socket = getSocket();
    socket.emit('reset-to-lobby', { roomCode: room.roomCode });
  }, [room]);

  // Leave room locally
  const handleLeaveRoom = useCallback(() => {
    clearSession();
    setSavedSession(null);
    setRoom(null);
    setMyPlayer(null);
    setPrivateState({});
    setPreRoomScreen('home');
  }, []);

  // Pre-Room flow handlers
  const handleLoadingComplete = useCallback(() => {
    const profile = loadUserProfile();
    setUserProfile(profile);

    const searchParams =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
    const urlCode = searchParams?.get('room') || searchParams?.get('code');

    if (profile && profile.name.trim()) {
      if (urlCode && urlCode.trim().length === 4) {
        setPreRoomScreen('join-room');
      } else {
        setPreRoomScreen('home');
      }
    } else {
      setPreRoomScreen('name-entry');
    }
  }, []);

  const handleNameEntryContinue = useCallback(
    (name: string, colorIndex: number) => {
      setUserProfile({ name, colorIndex });
      const searchParams =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null;
      const urlCode = searchParams?.get('room') || searchParams?.get('code');

      if (urlCode && urlCode.trim().length === 4) {
        setPreRoomScreen('join-room');
      } else {
        setPreRoomScreen('home');
      }
    },
    []
  );

  const handleCreateRoomFromHome = useCallback(() => {
    if (!userProfile) {
      setPreRoomScreen('name-entry');
      return;
    }
    handleCreateRoom(userProfile.name, userProfile.colorIndex);
  }, [userProfile, handleCreateRoom]);

  const handleJoinFromJoinScreen = useCallback(
    (roomCode: string) => {
      if (!userProfile) {
        setPreRoomScreen('name-entry');
        return;
      }
      handleJoinRoom(roomCode, userProfile.name, userProfile.colorIndex);
    },
    [userProfile, handleJoinRoom]
  );

  return (
    <div className="mobile-app-shell">
      {/* Top Header shown during active room sessions */}
      {room && myPlayer && (
        <Header
          roomCode={room.roomCode}
          myPlayer={myPlayer}
          connected={connected}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {/* Screen Router based on current Room, Phase, or Pre-Room state */}
      {!room || !myPlayer ? (
        preRoomScreen === 'loading' ? (
          <LoadingScreen onComplete={handleLoadingComplete} />
        ) : preRoomScreen === 'name-entry' ? (
          <NameEntryScreen
            initialName={userProfile?.name || ''}
            initialColorIndex={userProfile?.colorIndex ?? 0}
            onContinue={handleNameEntryContinue}
            isEditing={Boolean(userProfile)}
          />
        ) : preRoomScreen === 'join-room' ? (
          <JoinRoomScreen
            onJoinRoom={handleJoinFromJoinScreen}
            onBack={() => {
              setErrorMessage(null);
              setPreRoomScreen('home');
            }}
            loading={loading}
            errorMessage={errorMessage}
          />
        ) : (
          <HomeScreen
            playerName={userProfile?.name || 'Player'}
            playerColorIndex={userProfile?.colorIndex ?? 0}
            onCreateRoom={handleCreateRoomFromHome}
            onNavigateToJoin={() => {
              setErrorMessage(null);
              setPreRoomScreen('join-room');
            }}
            onEditProfile={() => setPreRoomScreen('name-entry')}
            onReconnect={handleReconnect}
            savedSession={savedSession}
            loading={loading}
          />
        )
      ) : room.phase === 'lobby' ? (
        <LobbyScreen
          room={room}
          myPlayer={myPlayer}
          onStartGame={handleGoToGameSelect}
          onAddBot={handleAddBot}
        />
      ) : room.phase === 'game-select' ? (
        <GameSelectScreen
          room={room}
          myPlayer={myPlayer}
          onSelectGame={handleSelectGame}
          onConfirmAndStart={handleConfirmAndStartRound}
        />
      ) : room.phase === 'reveal' ? (
        <RevealPhaseScreen
          room={room}
          myPlayer={myPlayer}
          privateState={privateState}
          onAdvance={() => handleAdvancePhase('input')}
        />
      ) : room.phase === 'input' ? (
        <InputPhaseScreen
          room={room}
          myPlayer={myPlayer}
          privateState={privateState}
          onSubmitAnswer={handleSubmitAnswer}
          onHostSkip={() => handleAdvancePhase('reveal-answers')}
        />
      ) : room.phase === 'reveal-answers' ? (
        <RevealAnswersScreen
          room={room}
          myPlayer={myPlayer}
          onAdvance={() => handleAdvancePhase('discussion')}
        />
      ) : room.phase === 'discussion' ? (
        <DiscussionPhaseScreen
          room={room}
          myPlayer={myPlayer}
          onAdvanceToVote={() => handleAdvancePhase('vote')}
        />
      ) : room.phase === 'vote' ? (
        <VotePhaseScreen
          room={room}
          myPlayer={myPlayer}
          privateState={privateState}
          onCastVote={handleCastVote}
          onHostSkip={() => handleAdvancePhase('results')}
        />
      ) : room.phase === 'results' ? (
        <ResultsPhaseScreen
          room={room}
          myPlayer={myPlayer}
          onNextRound={() => handleAdvancePhase('next-round')}
          onReturnToLobby={handleReturnToLobby}
          onEndSession={() => handleAdvancePhase('post-game')}
        />
      ) : room.phase === 'post-game' ? (
        <PostGameScreen
          room={room}
          myPlayer={myPlayer}
          onPlayAgain={() => handleAdvancePhase('reveal')}
          onChooseNewGame={() => handleAdvancePhase('game-select')}
          onLeaveRoom={handleLeaveRoom}
        />
      ) : (
        <LobbyScreen
          room={room}
          myPlayer={myPlayer}
          onStartGame={handleGoToGameSelect}
          onAddBot={handleAddBot}
        />
      )}
    </div>
  );
}
