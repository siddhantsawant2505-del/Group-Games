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
import { AtwRevealScreen } from './screens/AtwRevealScreen';
import { AtwDescriberScreen } from './screens/AtwDescriberScreen';
import { AtwListenerScreen } from './screens/AtwListenerScreen';
import { AtwResultsScreen } from './screens/AtwResultsScreen';
import { MafiaRevealScreen } from './screens/MafiaRevealScreen';
import { MafiaNightActionScreen } from './screens/MafiaNightActionScreen';
import { MafiaTownSleepsScreen } from './screens/MafiaTownSleepsScreen';
import { MafiaMorningScreen } from './screens/MafiaMorningScreen';
import { MafiaResultsScreen } from './screens/MafiaResultsScreen';
import { GtlHintRevealScreen } from './screens/GtlHintRevealScreen';
import { GtlInputScreen } from './screens/GtlInputScreen';
import { GtlResponseRevealScreen } from './screens/GtlResponseRevealScreen';
import { GtlGuessScreen } from './screens/GtlGuessScreen';
import { GtlResultsScreen } from './screens/GtlResultsScreen';
import { Top100RevealScreen } from './screens/Top100RevealScreen';
import { Top100InputScreen } from './screens/Top100InputScreen';
import { Top100BoardScreen } from './screens/Top100BoardScreen';
import { Top100RankScreen } from './screens/Top100RankScreen';
import { Top100ResultsScreen } from './screens/Top100ResultsScreen';

/** Games that ship with a dedicated server-side rules module. */
const AVOID_THE_WORD_GAME_ID = 'avoid-the-word';
const MAFIA_GAME_ID = 'mafia';
const GUESS_THE_LINK_GAME_ID = 'guess-the-link';
const TOP_100_GAME_ID = 'top-100';

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

  // Guess the Link: host queues a custom concept + hint angles for the next round
  const handleSaveGtlPrompt = useCallback(
    (
      input: { concept: string; category?: string; hints?: string[] },
      callback: (res: any) => void
    ) => {
      if (!room || !myPlayer) return;
      const socket = getSocket();
      socket.emit(
        'gtl-set-prompt',
        {
          roomCode: room.roomCode,
          playerId: myPlayer.id,
          concept: input.concept,
          category: input.category,
          hints: input.hints,
        },
        callback
      );
    },
    [room, myPlayer]
  );

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

  // Avoid the Word: toggle a buzz on the active describer
  const handleAtwBuzz = useCallback(() => {
    if (!room || !myPlayer) return;
    playNotificationSound('timer-warning');
    triggerHaptic('heavy');
    const socket = getSocket();
    socket.emit('atw-buzz', {
      roomCode: room.roomCode,
      playerId: myPlayer.id,
    });
  }, [room, myPlayer]);

  // Avoid the Word: host confirms (ends the turn) or dismisses a pending buzz
  const handleAtwResolveBuzz = useCallback(
    (confirm: boolean) => {
      if (!room || !myPlayer) return;
      playNotificationSound(confirm ? 'submit-lock' : 'tick');
      triggerHaptic(confirm ? 'medium' : 'light');
      const socket = getSocket();
      socket.emit('atw-resolve-buzz', {
        roomCode: room.roomCode,
        playerId: myPlayer.id,
        confirm,
      });
    },
    [room, myPlayer]
  );

  // Avoid the Word: describer (or host) hands the turn over early
  const handleAtwEndTurn = useCallback(() => {
    if (!room || !myPlayer) return;
    playNotificationSound('success');
    triggerHaptic('success');
    const socket = getSocket();
    socket.emit('atw-end-turn', {
      roomCode: room.roomCode,
      playerId: myPlayer.id,
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

  // Mafia: a night actor (Mafia/Detective) locks in a target
  const handleMafiaNightAction = useCallback(
    (targetPlayerId: string) => {
      if (!room || !myPlayer) return;
      playNotificationSound('submit-lock');
      triggerHaptic('heavy');
      const socket = getSocket();
      socket.emit('mafia-night-action', {
        roomCode: room.roomCode,
        playerId: myPlayer.id,
        targetPlayerId,
      });
    },
    [room, myPlayer]
  );

  // Mafia: host skip that resolves the night early
  const handleMafiaResolveNight = useCallback(() => {
    if (!room || !myPlayer) return;
    playNotificationSound('phase-change');
    triggerHaptic('medium');
    const socket = getSocket();
    socket.emit('mafia-resolve-night', {
      roomCode: room.roomCode,
      playerId: myPlayer.id,
    });
  }, [room, myPlayer]);

  // Guess the Link: a player locks in their guess at the hidden concept
  const handleGtlGuess = useCallback(
    (guess: string) => {
      if (!room || !myPlayer) return;
      playNotificationSound('submit-lock');
      triggerHaptic('heavy');
      const socket = getSocket();
      socket.emit('gtl-guess', {
        roomCode: room.roomCode,
        playerId: myPlayer.id,
        guess,
      });
    },
    [room, myPlayer]
  );

  // Mafia: host skip that resolves the exile trial early
  const handleMafiaResolveTrial = useCallback(() => {
    if (!room || !myPlayer) return;
    playNotificationSound('phase-change');
    triggerHaptic('medium');
    const socket = getSocket();
    socket.emit('mafia-resolve-vote', {
      roomCode: room.roomCode,
      playerId: myPlayer.id,
    });
  }, [room, myPlayer]);

  // Top 100: the host pushes their live drag order
  const handleTop100Reorder = useCallback(
    (order: string[]) => {
      if (!room || !myPlayer) return;
      const socket = getSocket();
      socket.emit('top100-reorder', {
        roomCode: room.roomCode,
        playerId: myPlayer.id,
        order,
      });
    },
    [room, myPlayer]
  );

  // Top 100: the host locks the ordering in and reveals the true numbers
  const handleTop100LockOrder = useCallback(() => {
    if (!room || !myPlayer) return;
    playNotificationSound('phase-change');
    triggerHaptic('medium');
    const socket = getSocket();
    socket.emit('top100-lock-order', {
      roomCode: room.roomCode,
      playerId: myPlayer.id,
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

  // Avoid the Word and Mafia run on their own phase chains and dedicated screens
  const isAvoidTheWord = room?.selectedGame?.id === AVOID_THE_WORD_GAME_ID;
  const isMafia = room?.selectedGame?.id === MAFIA_GAME_ID;
  const isGuessTheLink = room?.selectedGame?.id === GUESS_THE_LINK_GAME_ID;
  const isTop100 = room?.selectedGame?.id === TOP_100_GAME_ID;
  const isAtwDescriber = Boolean(
    privateState.atwIsDescriber || room?.atwState?.describerPlayerId === myPlayer?.id
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
          onSaveGtlPrompt={handleSaveGtlPrompt}
        />
      ) : room.phase === 'reveal' ? (
        isAvoidTheWord ? (
          <AtwRevealScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onAdvance={() => handleAdvancePhase('atw-describe')}
          />
        ) : isMafia ? (
          <MafiaRevealScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onAdvance={() => handleAdvancePhase('night')}
          />
        ) : isGuessTheLink ? (
          <GtlHintRevealScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onAdvance={() => handleAdvancePhase('input')}
          />
        ) : isTop100 ? (
          <Top100RevealScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onAdvance={() => handleAdvancePhase('input')}
          />
        ) : (
          <RevealPhaseScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onAdvance={() => handleAdvancePhase('input')}
          />
        )
      ) : room.phase === 'atw-describe' ? (
        isAtwDescriber ? (
          <AtwDescriberScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onEndTurn={handleAtwEndTurn}
            onResolveBuzz={handleAtwResolveBuzz}
          />
        ) : (
          <AtwListenerScreen
            room={room}
            myPlayer={myPlayer}
            onBuzz={handleAtwBuzz}
            onResolveBuzz={handleAtwResolveBuzz}
          />
        )
      ) : room.phase === 'night' ? (
        privateState.mafiaCanAct ? (
          <MafiaNightActionScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onSelectTarget={handleMafiaNightAction}
            onHostResolveNight={handleMafiaResolveNight}
          />
        ) : (
          <MafiaTownSleepsScreen
            room={room}
            myPlayer={myPlayer}
            onHostResolveNight={handleMafiaResolveNight}
          />
        )
      ) : room.phase === 'day' ? (
        <MafiaMorningScreen
          room={room}
          myPlayer={myPlayer}
          onAdvance={() => handleAdvancePhase('discussion')}
        />
      ) : room.phase === 'input' ? (
        isGuessTheLink ? (
          <GtlInputScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onSubmitAnswer={handleSubmitAnswer}
            onHostSkip={() => handleAdvancePhase('reveal-answers')}
          />
        ) : isTop100 ? (
          <Top100InputScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onSubmitAnswer={handleSubmitAnswer}
            onHostSkip={() => handleAdvancePhase('reveal-answers')}
          />
        ) : (
          <InputPhaseScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onSubmitAnswer={handleSubmitAnswer}
            onHostSkip={() => handleAdvancePhase('reveal-answers')}
          />
        )
      ) : room.phase === 'reveal-answers' ? (
        isGuessTheLink ? (
          <GtlResponseRevealScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onAdvance={() => handleAdvancePhase('guess')}
          />
        ) : isTop100 ? (
          <Top100BoardScreen
            room={room}
            myPlayer={myPlayer}
            onAdvance={() => handleAdvancePhase('rank')}
          />
        ) : (
          <RevealAnswersScreen
            room={room}
            myPlayer={myPlayer}
            onAdvance={() => handleAdvancePhase('discussion')}
          />
        )
      ) : room.phase === 'guess' ? (
        <GtlGuessScreen
          room={room}
          myPlayer={myPlayer}
          privateState={privateState}
          onGuess={handleGtlGuess}
          onHostSkip={() => handleAdvancePhase('results')}
        />
      ) : room.phase === 'rank' ? (
        <Top100RankScreen
          room={room}
          myPlayer={myPlayer}
          onReorder={handleTop100Reorder}
          onLockOrder={handleTop100LockOrder}
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
          eligiblePlayerIds={isMafia ? room.mafiaState?.alivePlayerIds : undefined}
          onHostSkip={() =>
            isMafia ? handleMafiaResolveTrial() : handleAdvancePhase('results')
          }
        />
      ) : room.phase === 'results' ? (
        isAvoidTheWord ? (
          <AtwResultsScreen
            room={room}
            myPlayer={myPlayer}
            onNextRound={() => handleAdvancePhase('next-round')}
            onReturnToLobby={handleReturnToLobby}
            onEndSession={() => handleAdvancePhase('post-game')}
          />
        ) : isMafia ? (
          <MafiaResultsScreen
            room={room}
            myPlayer={myPlayer}
            onNextRound={() => handleAdvancePhase('next-round')}
            onReturnToLobby={handleReturnToLobby}
            onEndSession={() => handleAdvancePhase('post-game')}
          />
        ) : isGuessTheLink ? (
          <GtlResultsScreen
            room={room}
            myPlayer={myPlayer}
            onNextRound={() => handleAdvancePhase('next-round')}
            onReturnToLobby={handleReturnToLobby}
            onEndSession={() => handleAdvancePhase('post-game')}
          />
        ) : isTop100 ? (
          <Top100ResultsScreen
            room={room}
            myPlayer={myPlayer}
            onNextRound={() => handleAdvancePhase('next-round')}
            onReturnToLobby={handleReturnToLobby}
            onEndSession={() => handleAdvancePhase('post-game')}
          />
        ) : (
          <ResultsPhaseScreen
            room={room}
            myPlayer={myPlayer}
            onNextRound={() => handleAdvancePhase('next-round')}
            onReturnToLobby={handleReturnToLobby}
            onEndSession={() => handleAdvancePhase('post-game')}
          />
        )
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
