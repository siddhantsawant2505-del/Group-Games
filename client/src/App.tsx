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
import {
  RoomPublicState,
  Player,
  PlayerPrivateState,
  GamePhase,
  ImpostorSettings,
  AvoidSettings,
  PlayMode,
} from '@shared/types';
import type { RoomSettingsActions } from './screens/LobbyScreen';
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
import { AvoidAnchorRevealScreen } from './screens/avoidTheWord/AvoidAnchorRevealScreen';
import { AvoidTurnScreen } from './screens/avoidTheWord/AvoidTurnScreen';
import { AvoidRoundRevealScreen } from './screens/avoidTheWord/AvoidRoundRevealScreen';
import { AvoidResultsScreen } from './screens/avoidTheWord/AvoidResultsScreen';
import { RoleRevealScreen } from './screens/mafia/RoleRevealScreen';
import { NightScreen } from './screens/mafia/NightScreen';
import type { MafiaTeamPick } from './screens/mafia/NightScreen';
import { MorningScreen } from './screens/mafia/MorningScreen';
import { DayScreen } from './screens/mafia/DayScreen';
import { VoteScreen as MafiaVoteScreen } from './screens/mafia/VoteScreen';
import { ExileScreen } from './screens/mafia/ExileScreen';
import { GameOverScreen } from './screens/mafia/GameOverScreen';
import { GtlHintRevealScreen } from './screens/GtlHintRevealScreen';
import { GtlInputScreen } from './screens/GtlInputScreen';
import { GtlResponseRevealScreen } from './screens/GtlResponseRevealScreen';
import { GtlGuessScreen } from './screens/GtlGuessScreen';
import { GtlResultsScreen } from './screens/GtlResultsScreen';
import { Top100QuestionScreen } from './screens/top100/Top100QuestionScreen';
import { Top100GuessScreen } from './screens/top100/Top100GuessScreen';
import { Top100GuessesRevealScreen } from './screens/top100/Top100GuessesRevealScreen';
import { Top100ListSlicesScreen } from './screens/top100/Top100ListSlicesScreen';
import { RevealAnswersCopy } from './screens/RevealAnswersScreen';
import { VoteCopy } from './screens/VotePhaseScreen';
import { RevCatItemsScreen } from './screens/RevCatItemsScreen';
import { RevCatInputScreen } from './screens/RevCatInputScreen';
import { RevCatResultsScreen } from './screens/RevCatResultsScreen';
import { ImpostorQuestionRevealScreen } from './screens/ImpostorQuestionRevealScreen';
import { ImpostorAnswerScreen } from './screens/ImpostorAnswerScreen';
import { ImpostorAnswersGridScreen } from './screens/ImpostorAnswersGridScreen';

/** Games that ship with a dedicated server-side rules module. */
const AVOID_THE_WORD_GAME_ID = 'avoid-the-word';
const MAFIA_GAME_ID = 'mafia';
const GUESS_THE_LINK_GAME_ID = 'guess-the-link';
const TOP_100_GAME_ID = 'top-100';
const REVERSE_CATEGORIES_GAME_ID = 'reverse-categories';

/** Reverse Categories reuses the answers screen and the secret ballot with its own framing. */
const RC_BOARD_COPY: RevealAnswersCopy = {
  badge: 'Categories Invented',
  title: 'The Category Board',
  subtitle: 'Read every invented category — then vote for the one that links the items best',
  timerLabel: 'Reading the Board',
  actionLabel: 'Start Voting',
  actionSubtext: 'Everyone votes for the best category',
  waitingLabel: 'Voting opens when the host moves on or the timer runs out...',
};

const RC_VOTE_COPY: VoteCopy = {
  badge: 'Pick the best one',
  title: 'Vote Best Category',
  pickLabel: 'Choose the Cleverest Category',
  pickHint: 'Tap the category you think links the three items best',
  answerLabel: 'Category:',
  missingAnswerLabel: '(No category)',
  targetRoleLabel: 'Category author',
  confirmLabel: 'Confirm your vote for',
  selectHint: 'Select a category above to vote',
  actionLabel: 'Lock In Vote',
  actionLoadingLabel: 'Casting vote...',
  lockedTitle: 'Vote Locked In!',
  lockedPrefix: 'You voted for',
};

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
  /** Mafia's faction-private live picks (only living Mafia ever receive them). */
  const [mafiaTeamPicks, setMafiaTeamPicks] = useState<MafiaTeamPick[] | null>(null);
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

    // Mafia only: the family's live night picks.
    const handleMafiaTeamUpdate = (payload: { picks?: MafiaTeamPick[] }) => {
      setMafiaTeamPicks(payload?.picks ?? null);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room:update', handleRoomUpdate);
    socket.on('player:private-state', handlePrivateState);
    socket.on('mafia:team-update', handleMafiaTeamUpdate);

    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room:update', handleRoomUpdate);
      socket.off('player:private-state', handlePrivateState);
      socket.off('mafia:team-update', handleMafiaTeamUpdate);
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

  // Host updates the selected game's public settings (Impostor difficulty/theme)
  const handleSaveGameSettings = useCallback(
    (
      patch: { impostor?: Partial<ImpostorSettings>; avoidTheWord?: Partial<AvoidSettings> },
      callback: (res: { success: boolean; error?: string }) => void
    ) => {
      if (!room || !myPlayer) return;
      const socket = getSocket();
      socket.emit(
        'set-game-settings',
        { roomCode: room.roomCode, playerId: myPlayer.id, settings: patch },
        callback
      );
    },
    [room, myPlayer]
  );

  // Room settings: one emit helper for the whole lobby settings sheet.
  const emitRoomAction = useCallback(
    (event: string, payload: Record<string, unknown>, callback?: (res: any) => void) => {
      if (!room || !myPlayer) {
        callback?.({ success: false, error: 'Room is not ready.' });
        return;
      }
      const socket = getSocket();
      socket.emit(event, { roomCode: room.roomCode, playerId: myPlayer.id, ...payload }, callback);
    },
    [room, myPlayer]
  );

  const roomSettingsActions: RoomSettingsActions = {
    onSetPlayMode: useCallback(
      (mode: PlayMode) => emitRoomAction('set-play-mode', { mode }),
      [emitRoomAction]
    ),
    onSetTeamCount: useCallback(
      (count: number) => emitRoomAction('set-team-count', { count }),
      [emitRoomAction]
    ),
    onJoinTeam: useCallback(
      (teamId: string) => emitRoomAction('join-team', { teamId }),
      [emitRoomAction]
    ),
    onRenameTeam: useCallback(
      (teamId: string, name: string) => emitRoomAction('rename-team', { teamId, name }),
      [emitRoomAction]
    ),
    onBalanceTeams: useCallback(
      (shuffle: boolean) => emitRoomAction('balance-teams', { shuffle }),
      [emitRoomAction]
    ),
    onSetRoundCount: useCallback(
      (rounds: number) => emitRoomAction('set-round-count', { rounds }),
      [emitRoomAction]
    ),
  };

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

  // Avoid the Word: the player whose input is open (anchor or turn) locks it in
  const handleAvoidAnswer = useCallback(
    (answer: string, targetPlayerId?: string) => {
      if (!room || !myPlayer) return;
      playNotificationSound('submit-lock');
      triggerHaptic('success');
      const socket = getSocket();
      socket.emit('avoid-answer', {
        roomCode: room.roomCode,
        playerId: myPlayer.id,
        answer,
        ...(targetPlayerId ? { targetPlayerId } : {}),
      });
    },
    [room, myPlayer]
  );

  // Avoid the Word: the host overrules a close call during the round reveal
  const handleAvoidOverrule = useCallback(
    (targetPlayerId: string, countAsMatch: boolean) => {
      if (!room || !myPlayer) return;
      playNotificationSound(countAsMatch ? 'submit-lock' : 'tick');
      triggerHaptic('light');
      const socket = getSocket();
      socket.emit('avoid-overrule', {
        roomCode: room.roomCode,
        playerId: myPlayer.id,
        targetPlayerId,
        countAsMatch,
      });
    },
    [room, myPlayer]
  );

  // Avoid the Word: the host applies the round's eliminations
  const handleAvoidContinue = useCallback(() => {
    if (!room || !myPlayer) return;
    playNotificationSound('phase-change');
    triggerHaptic('medium');
    const socket = getSocket();
    socket.emit('avoid-continue', {
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

  // Mafia: every living player locks a night action (or confirms the decoy).
  const handleMafiaNightAction = useCallback(
    (targetPlayerId: string | null) => {
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

  // Mafia: a secret ballot (a player id, or 'skip').
  const handleMafiaVote = useCallback(
    (targetPlayerId: string) => {
      if (!room || !myPlayer) return;
      playNotificationSound('submit-lock');
      triggerHaptic('heavy');
      const socket = getSocket();
      socket.emit('cast-vote', {
        roomCode: room.roomCode,
        voterId: myPlayer.id,
        targetPlayerId,
      });
    },
    [room, myPlayer]
  );

  // Mafia: ready to vote (more than half of the living ends discussion early).
  const handleMafiaReady = useCallback(() => {
    if (!room || !myPlayer) return;
    playNotificationSound('submit-lock');
    triggerHaptic('medium');
    const socket = getSocket();
    socket.emit('mafia-ready-vote', { roomCode: room.roomCode, playerId: myPlayer.id });
  }, [room, myPlayer]);

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

  // Top 100 (team mode): a short suggestion only this player's team sees
  const handleTop100Suggestion = useCallback(
    (text: string) => {
      if (!room || !myPlayer) return;
      const socket = getSocket();
      socket.emit('top100-suggest', {
        roomCode: room.roomCode,
        playerId: myPlayer.id,
        text,
      });
    },
    [room, myPlayer]
  );

  // Top 100: the host overrules one guess (a forced position, or null = off list)
  const handleTop100Overrule = useCallback(
    (rowId: string, rank: number | null) => {
      if (!room || !myPlayer) return;
      triggerHaptic('light');
      const socket = getSocket();
      socket.emit('top100-overrule', {
        roomCode: room.roomCode,
        playerId: myPlayer.id,
        rowId,
        rank,
      });
    },
    [room, myPlayer]
  );

  // Top 100: the host finalises the points and opens the slices screen
  const handleTop100Continue = useCallback(() => {
    if (!room || !myPlayer) return;
    playNotificationSound('phase-change');
    triggerHaptic('medium');
    const socket = getSocket();
    socket.emit('top100-continue', {
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
  const isReverseCategories = room?.selectedGame?.id === REVERSE_CATEGORIES_GAME_ID;
  // Impostor runs two modes: 'word' (the classic round) and 'question'.
  const isImpostorQuestionMode =
    room?.selectedGame?.id === 'impostor' && room.gameSettings?.impostor?.mode === 'question';

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
          roomSettings={roomSettingsActions}
        />
      ) : room.phase === 'game-select' ? (
        <GameSelectScreen
          room={room}
          myPlayer={myPlayer}
          onSelectGame={handleSelectGame}
          onConfirmAndStart={handleConfirmAndStartRound}
          onSaveGtlPrompt={handleSaveGtlPrompt}
          onSaveGameSettings={handleSaveGameSettings}
        />
      ) : room.phase === 'reveal' ? (
        isAvoidTheWord ? (
          <AvoidAnchorRevealScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onAdvance={() => handleAdvancePhase('avoid-anchor')}
          />
        ) : isMafia ? (
          <RoleRevealScreen room={room} myPlayer={myPlayer} privateState={privateState} />
        ) : isGuessTheLink ? (
          <GtlHintRevealScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onAdvance={() => handleAdvancePhase('input')}
          />
        ) : isTop100 ? (
          <Top100QuestionScreen
            room={room}
            myPlayer={myPlayer}
            onAdvance={() => handleAdvancePhase('input')}
          />
        ) : isReverseCategories ? (
          <RevCatItemsScreen
            room={room}
            myPlayer={myPlayer}
            onAdvance={() => handleAdvancePhase('input')}
          />
        ) : isImpostorQuestionMode ? (
          <ImpostorQuestionRevealScreen
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
      ) : room.phase === 'avoid-anchor' || room.phase === 'avoid-turn' ? (
        <AvoidTurnScreen
          room={room}
          myPlayer={myPlayer}
          privateState={privateState}
          onSubmitAnswer={handleAvoidAnswer}
        />
      ) : room.phase === 'avoid-reveal' ? (
        <AvoidRoundRevealScreen
          room={room}
          myPlayer={myPlayer}
          onOverrule={handleAvoidOverrule}
          onContinue={handleAvoidContinue}
        />
      ) : room.phase === 'night' ? (
        <NightScreen
          room={room}
          myPlayer={myPlayer}
          privateState={privateState}
          teamPicks={mafiaTeamPicks}
          onSelectTarget={handleMafiaNightAction}
          onHostResolveNight={handleMafiaResolveNight}
        />
      ) : room.phase === 'mafia-morning' ? (
        <MorningScreen
          room={room}
          myPlayer={myPlayer}
          privateState={privateState}
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
          <Top100GuessScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onSubmitAnswer={handleSubmitAnswer}
            onSendSuggestion={handleTop100Suggestion}
            onHostSkip={() => handleAdvancePhase('reveal-answers')}
          />
        ) : isReverseCategories ? (
          <RevCatInputScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onSubmitAnswer={handleSubmitAnswer}
            onHostSkip={() => handleAdvancePhase('reveal-answers')}
          />
        ) : isImpostorQuestionMode ? (
          <ImpostorAnswerScreen
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
          <Top100GuessesRevealScreen
            room={room}
            myPlayer={myPlayer}
            onOverrule={handleTop100Overrule}
            onContinue={handleTop100Continue}
          />
        ) : isReverseCategories ? (
          <RevealAnswersScreen
            room={room}
            myPlayer={myPlayer}
            onAdvance={() => handleAdvancePhase('vote')}
            copy={RC_BOARD_COPY}
          />
        ) : isImpostorQuestionMode ? (
          <ImpostorAnswersGridScreen
            room={room}
            myPlayer={myPlayer}
            onAdvance={() => handleAdvancePhase('discussion')}
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
      ) : room.phase === 'discussion' ? (
        isMafia ? (
          <DayScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onReadyToVote={handleMafiaReady}
            onHostAdvance={() => handleAdvancePhase('vote')}
          />
        ) : (
          <DiscussionPhaseScreen
            room={room}
            myPlayer={myPlayer}
            onAdvanceToVote={() => handleAdvancePhase('vote')}
            ownQuestion={isImpostorQuestionMode ? privateState.impostorQuestion : undefined}
          />
        )
      ) : room.phase === 'vote' ? (
        isMafia ? (
          <MafiaVoteScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onVote={handleMafiaVote}
            onHostSkip={handleMafiaResolveTrial}
          />
        ) : (
          <VotePhaseScreen
            room={room}
            myPlayer={myPlayer}
            privateState={privateState}
            onCastVote={handleCastVote}
            eligiblePlayerIds={
              isReverseCategories
                ? room.players.filter((p) => p.id !== myPlayer.id).map((p) => p.id)
                : undefined
            }
            copy={isReverseCategories ? RC_VOTE_COPY : undefined}
            onHostSkip={() => handleAdvancePhase('results')}
          />
        )
      ) : room.phase === 'mafia-exile' ? (
        <ExileScreen room={room} myPlayer={myPlayer} privateState={privateState} />
      ) : room.phase === 'results' ? (
        isAvoidTheWord ? (
          <AvoidResultsScreen
            room={room}
            myPlayer={myPlayer}
            onNextRound={() => handleAdvancePhase('next-round')}
            onReturnToLobby={handleReturnToLobby}
            onEndSession={() => handleAdvancePhase('post-game')}
          />
        ) : isMafia ? (
          <GameOverScreen
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
          <Top100ListSlicesScreen
            room={room}
            myPlayer={myPlayer}
            onNextRound={() => handleAdvancePhase('next-round')}
            onReturnToLobby={handleReturnToLobby}
            onEndSession={() => handleAdvancePhase('post-game')}
          />
        ) : isReverseCategories ? (
          <RevCatResultsScreen
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
          roomSettings={roomSettingsActions}
        />
      )}
    </div>
  );
}
