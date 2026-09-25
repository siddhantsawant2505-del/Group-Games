/**
 * Server-authoritative Room and Phase State Manager.
 * In-memory room storage, phase state machine, and timer coordination.
 */

import {
  GamePhase,
  GameMetadata,
  Player,
  RoomPublicState,
  PlayerPrivateState,
  PhaseTimer,
  RevealedAnswer,
  RoleRevealInfo,
  PlayerResultStanding,
} from '../src/types';
import { PLAYER_COLORS } from '../src/theme/tokens';
import { PARTY_GAMES } from '../src/data/games';
import { getRandomImpostorWord } from '../src/data/impostorWords';
import {
  setupImpostorRound,
  recordPlayerClue,
  simulateImpostorBotClues,
  finalizeImpostorReveal,
  calculateImpostorResults,
  cleanupImpostorRound,
} from './games/impostor';

export interface InternalPlayer extends Player {
  socketId: string | null;
  isBot?: boolean;
}

export interface InternalRoom {
  code: string;
  hostId: string;
  players: InternalPlayer[];
  phase: GamePhase;
  selectedGame: GameMetadata | null;
  roundNumber: number;
  totalRounds: number;
  timer: PhaseTimer | null;
  timerIntervalId: NodeJS.Timeout | null;
  phasePrompt: string;
  phaseSubprompt?: string;
  hasSubmittedInput: Set<string>;
  hasVoted: Set<string>;
  revealedAnswers: RevealedAnswer[];
  voteTallies: Record<string, number>; // targetPlayerId -> count
  playerVotes: Record<string, string>; // voterPlayerId -> targetPlayerId
  privateData: Record<string, PlayerPrivateState>;
  results: RoomPublicState['results'];
  createdAt: number;
  lastActivityAt: number;
}

export class RoomManager {
  private rooms = new Map<string, InternalRoom>();

  /**
   * Generates a unique 4-character room code (avoiding confusing chars like 0/O, 1/I)
   */
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);
    return code;
  }

  public getRoom(code: string): InternalRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /**
   * Creates a new room with a host player
   */
  public createRoom(
    hostName: string,
    socketId: string
  ): { room: InternalRoom; host: InternalPlayer } {
    const code = this.generateRoomCode();
    const hostId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sessionToken = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const host: InternalPlayer = {
      id: hostId,
      name: hostName.trim() || 'Host',
      colorIndex: 0,
      colorHex: PLAYER_COLORS[0].hex,
      colorName: PLAYER_COLORS[0].label,
      isHost: true,
      connected: true,
      score: 0,
      sessionToken,
      joinedAt: Date.now(),
      socketId,
    };

    const room: InternalRoom = {
      code,
      hostId,
      players: [host],
      phase: 'lobby',
      selectedGame: PARTY_GAMES[0], // Default selected game is Impostor
      roundNumber: 1,
      totalRounds: 3,
      timer: null,
      timerIntervalId: null,
      phasePrompt: 'Waiting for players to join...',
      phaseSubprompt: 'Minimum 3 players required to start',
      hasSubmittedInput: new Set(),
      hasVoted: new Set(),
      revealedAnswers: [],
      voteTallies: {},
      playerVotes: {},
      privateData: {},
      results: null,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    this.rooms.set(code, room);
    return { room, host };
  }

  /**
   * Joins an existing room or reconnects an existing player
   */
  public joinOrReconnect(
    code: string,
    playerName: string,
    sessionToken: string | null,
    socketId: string
  ): {
    success: boolean;
    error?: string;
    room?: InternalRoom;
    player?: InternalPlayer;
    isReconnect?: boolean;
  } {
    const room = this.getRoom(code);
    if (!room) {
      return { success: false, error: 'Room not found. Please check the code.' };
    }

    room.lastActivityAt = Date.now();

    // 1. Check if reconnecting by sessionToken
    if (sessionToken) {
      const existing = room.players.find((p) => p.sessionToken === sessionToken);
      if (existing) {
        existing.connected = true;
        existing.socketId = socketId;
        if (playerName && playerName.trim()) {
          existing.name = playerName.trim();
        }
        return {
          success: true,
          room,
          player: existing,
          isReconnect: true,
        };
      }
    }

    // 2. Check if reconnecting by same name
    const existingByName = room.players.find(
      (p) => p.name.toLowerCase() === playerName.trim().toLowerCase()
    );
    if (existingByName) {
      existingByName.connected = true;
      existingByName.socketId = socketId;
      return {
        success: true,
        room,
        player: existingByName,
        isReconnect: true,
      };
    }

    // 3. New player joining
    if (room.phase !== 'lobby' && room.phase !== 'game-select') {
      return {
        success: false,
        error: 'Game is currently in progress. Please wait for the next round.',
      };
    }

    if (room.players.length >= 12) {
      return { success: false, error: 'Room is full (max 12 players).' };
    }

    const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newSessionToken = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const colorIndex = room.players.length % PLAYER_COLORS.length;
    const colorToken = PLAYER_COLORS[colorIndex];

    const newPlayer: InternalPlayer = {
      id: playerId,
      name: playerName.trim() || `Player ${room.players.length + 1}`,
      colorIndex,
      colorHex: colorToken.hex,
      colorName: colorToken.label,
      isHost: room.players.length === 0,
      connected: true,
      score: 0,
      sessionToken: newSessionToken,
      joinedAt: Date.now(),
      socketId,
    };

    room.players.push(newPlayer);
    return {
      success: true,
      room,
      player: newPlayer,
      isReconnect: false,
    };
  }

  /**
   * Adds a test/bot player to simplify solo testing in preview
   */
  public addBotPlayer(code: string): { success: boolean; bot?: InternalPlayer; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { success: false, error: 'Room not found' };
    if (room.players.length >= 12) return { success: false, error: 'Room full' };

    const botNames = ['Sam', 'Alex', 'Taylor', 'Jordan', 'Riley', 'Morgan', 'Casey', 'Quinn'];
    const usedNames = new Set(room.players.map((p) => p.name));
    const availableName = botNames.find((n) => !usedNames.has(n)) || `Player ${room.players.length + 1}`;

    const colorIndex = room.players.length % PLAYER_COLORS.length;
    const colorToken = PLAYER_COLORS[colorIndex];
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const bot: InternalPlayer = {
      id: botId,
      name: availableName,
      colorIndex,
      colorHex: colorToken.hex,
      colorName: colorToken.label,
      isHost: false,
      connected: true,
      score: 0,
      sessionToken: `bot_token_${botId}`,
      joinedAt: Date.now(),
      socketId: null,
      isBot: true,
    };

    room.players.push(bot);
    return { success: true, bot };
  }

  /**
   * Handles player disconnection
   */
  public handleDisconnect(socketId: string): {
    room?: InternalRoom;
    player?: InternalPlayer;
  } {
    for (const room of this.rooms.values()) {
      const player = room.players.find((p) => p.socketId === socketId);
      if (player) {
        player.connected = false;
        player.socketId = null;

        // If host disconnected and others are present, reassign host
        if (player.isHost) {
          const nextActive = room.players.find((p) => p.connected && !p.isBot);
          if (nextActive) {
            player.isHost = false;
            nextActive.isHost = true;
            room.hostId = nextActive.id;
          }
        }

        return { room, player };
      }
    }
    return {};
  }

  /**
   * Selects a game on the game-select screen
   */
  public selectGame(code: string, gameId: string): boolean {
    const room = this.getRoom(code);
    if (!room) return false;
    const game = PARTY_GAMES.find((g) => g.id === gameId);
    if (!game) return false;
    room.selectedGame = game;
    return true;
  }

  /**
   * Starts a phase timer on the server.
   * Decrements every second and invokes onExpire callback when done.
   */
  public startPhaseTimer(
    room: InternalRoom,
    durationSeconds: number,
    onTick: (remaining: number) => void,
    onExpire: () => void
  ) {
    if (room.timerIntervalId) {
      clearInterval(room.timerIntervalId);
      room.timerIntervalId = null;
    }

    const endsAt = Date.now() + durationSeconds * 1000;
    room.timer = {
      durationSeconds,
      endsAtTimestamp: endsAt,
      remainingSeconds: durationSeconds,
    };

    room.timerIntervalId = setInterval(() => {
      if (!room.timer) {
        if (room.timerIntervalId) clearInterval(room.timerIntervalId);
        return;
      }

      const remaining = Math.max(0, Math.ceil((room.timer.endsAtTimestamp - Date.now()) / 1000));
      room.timer.remainingSeconds = remaining;
      onTick(remaining);

      if (remaining <= 0) {
        if (room.timerIntervalId) {
          clearInterval(room.timerIntervalId);
          room.timerIntervalId = null;
        }
        room.timer = null;
        onExpire();
      }
    }, 1000);
  }

  public clearPhaseTimer(room: InternalRoom) {
    if (room.timerIntervalId) {
      clearInterval(room.timerIntervalId);
      room.timerIntervalId = null;
    }
    room.timer = null;
  }

  /**
   * Transition between phases in the generic round framework
   */
  public transitionToPhase(
    room: InternalRoom,
    newPhase: GamePhase,
    broadcastState: () => void
  ) {
    this.clearPhaseTimer(room);
    room.phase = newPhase;

    switch (newPhase) {
      case 'lobby': {
        room.phasePrompt = 'Lobby';
        room.phaseSubprompt = 'Invite friends to join with room code';
        room.hasSubmittedInput.clear();
        room.hasVoted.clear();
        room.revealedAnswers = [];
        room.voteTallies = {};
        room.playerVotes = {};
        room.privateData = {};
        room.results = null;
        break;
      }

      case 'game-select': {
        room.phasePrompt = 'Choose a Game';
        room.phaseSubprompt = 'Host picks the game collection for this round';
        break;
      }

      case 'reveal': {
        // Prepare private roles/words based on selected game
        if (room.selectedGame?.id === 'impostor') {
          setupImpostorRound(room);
        } else {
          this.setupPhaseReveal(room);
        }
        room.phasePrompt = 'Check Your Secret Role';
        room.phaseSubprompt = 'Keep your screen hidden from others!';
        this.startPhaseTimer(
          room,
          10,
          () => broadcastState(),
          () => this.transitionToPhase(room, 'input', broadcastState)
        );
        break;
      }

      case 'input': {
        room.phasePrompt = 'Submit Your Clue';
        room.phaseSubprompt = 'Enter a one-word clue before the timer expires';
        room.hasSubmittedInput.clear();

        // Auto-populate bot answers if any bots are in room
        if (room.selectedGame?.id === 'impostor') {
          simulateImpostorBotClues(room);
        } else {
          this.simulateBotInputs(room);
        }

        this.startPhaseTimer(
          room,
          20,
          () => broadcastState(),
          () => {
            if (room.selectedGame?.id === 'impostor') {
              finalizeImpostorReveal(room);
            }
            this.transitionToPhase(room, 'reveal-answers', broadcastState);
          }
        );
        break;
      }

      case 'reveal-answers': {
        room.phasePrompt = 'Simultaneous Reveal';
        room.phaseSubprompt = 'Review every player’s clue in randomized order';
        if (room.selectedGame?.id === 'impostor') {
          finalizeImpostorReveal(room);
        } else {
          this.prepareRevealedAnswers(room);
        }
        this.startPhaseTimer(
          room,
          15,
          () => broadcastState(),
          () => this.transitionToPhase(room, 'discussion', broadcastState)
        );
        break;
      }

      case 'discussion': {
        room.phasePrompt = 'Group Discussion';
        room.phaseSubprompt = 'Compare clues, spot the bluffer, or skip early to vote!';
        this.startPhaseTimer(
          room,
          90,
          () => broadcastState(),
          () => this.transitionToPhase(room, 'vote', broadcastState)
        );
        break;
      }

      case 'vote': {
        room.phasePrompt = 'Cast Your Accusation';
        room.phaseSubprompt = 'Tap a suspect to vote them out';
        room.hasVoted.clear();
        room.voteTallies = {};
        room.playerVotes = {};

        // Auto-cast bot votes
        this.simulateBotVotes(room);

        this.startPhaseTimer(
          room,
          25,
          () => broadcastState(),
          () => this.transitionToPhase(room, 'results', broadcastState)
        );
        break;
      }

      case 'results': {
        if (room.selectedGame?.id === 'impostor') {
          calculateImpostorResults(room);
        } else {
          this.calculateResults(room);
        }
        room.phasePrompt = 'Round Results';
        room.phaseSubprompt = 'Points awarded and secrets unmasked!';
        break;
      }

      case 'next-round': {
        room.roundNumber += 1;
        this.transitionToPhase(room, 'reveal', broadcastState);
        return;
      }
    }

    broadcastState();
  }

  /**
   * Sets up private data per player for the reveal phase
   */
  private setupPhaseReveal(room: InternalRoom) {
    const gameId = room.selectedGame?.id || 'impostor';
    room.privateData = {};

    // Pick 1 player randomly to be Impostor/Special Role
    const impostorIndex = Math.floor(Math.random() * room.players.length);
    const wordItem = getRandomImpostorWord();
    const secretWord = wordItem.word;
    const secretCategory = `${wordItem.category}${wordItem.difficulty ? ` (${wordItem.difficulty})` : ''}`;

    room.players.forEach((player, index) => {
      const isImpostor = index === impostorIndex;

      if (gameId === 'impostor') {
        room.privateData[player.id] = {
          role: isImpostor ? 'The Impostor' : 'Crew Member',
          secretWord: isImpostor ? '???' : secretWord,
          secretHint: isImpostor
            ? `Category: ${secretCategory} (Blend in!)`
            : `Give subtle clues about ${secretWord}`,
          isSpecialRole: isImpostor,
          specialAccentBg: isImpostor,
          secretInstructions: isImpostor
            ? 'You do NOT know the secret word. Blend in and guess what others are hinting!'
            : 'You know the secret word. Find who is bluffing!',
          inputPlaceholder: isImpostor ? 'A vague, safe clue...' : 'Your subtle clue...',
        };
      } else {
        // Generic party game reveal
        room.privateData[player.id] = {
          role: `Player ${player.colorIndex + 1}`,
          secretWord: `Word #${index + 1}`,
          secretHint: 'Follow the prompt and give your best response!',
          isSpecialRole: false,
          specialAccentBg: false,
          secretInstructions: 'Get ready to write your answer.',
          inputPlaceholder: 'Type your answer here...',
        };
      }
    });
  }

  /**
   * Automatically provides sample answers for test bots
   */
  private simulateBotInputs(room: InternalRoom) {
    const sampleClues = ['Deep waters', 'Yellow color', 'Metal cylinder', 'Periscope vision'];
    room.players.forEach((player, idx) => {
      if (player.isBot) {
        const clue = sampleClues[idx % sampleClues.length];
        room.hasSubmittedInput.add(player.id);
        if (room.privateData[player.id]) {
          room.privateData[player.id].submittedAnswer = clue;
          room.privateData[player.id].inputSubmitted = true;
        }
      }
    });
  }

  /**
   * Automatically casts votes for test bots
   */
  private simulateBotVotes(room: InternalRoom) {
    room.players.forEach((player) => {
      if (player.isBot) {
        // Pick another random player
        const candidates = room.players.filter((p) => p.id !== player.id);
        if (candidates.length > 0) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
          room.hasVoted.add(player.id);
          room.playerVotes[player.id] = target.id;
          room.voteTallies[target.id] = (room.voteTallies[target.id] || 0) + 1;
        }
      }
    });
  }

  /**
   * Compiles revealed answers from submitted inputs
   */
  private prepareRevealedAnswers(room: InternalRoom) {
    room.revealedAnswers = room.players.map((player) => {
      const privateState = room.privateData[player.id];
      const answer = privateState?.submittedAnswer || '(No clue submitted in time)';
      return {
        playerId: player.id,
        playerName: player.name,
        playerColor: player.colorHex,
        colorIndex: player.colorIndex,
        answerText: answer,
        revealed: true,
        subtext: player.isHost ? 'Host' : undefined,
      };
    });
  }

  /**
   * Submits player input during 'input' phase
   */
  public submitInput(
    room: InternalRoom,
    playerId: string,
    answer: string,
    broadcastState: () => void
  ) {
    if (room.phase !== 'input') return;

    if (room.selectedGame?.id === 'impostor') {
      recordPlayerClue(room, playerId, answer);
    } else {
      room.hasSubmittedInput.add(playerId);
      if (!room.privateData[playerId]) {
        room.privateData[playerId] = {};
      }
      room.privateData[playerId].submittedAnswer = answer.trim() || '(Blank)';
      room.privateData[playerId].inputSubmitted = true;
    }

    // If all active players submitted, auto advance
    const activeCount = room.players.filter((p) => p.connected).length;
    if (room.hasSubmittedInput.size >= activeCount) {
      if (room.selectedGame?.id === 'impostor') {
        finalizeImpostorReveal(room);
      }
      this.transitionToPhase(room, 'reveal-answers', broadcastState);
    } else {
      broadcastState();
    }
  }

  /**
   * Casts a vote during 'vote' phase
   */
  public castVote(
    room: InternalRoom,
    voterId: string,
    targetPlayerId: string,
    broadcastState: () => void
  ) {
    if (room.phase !== 'vote') return;

    // Register or update vote
    const prevTarget = room.playerVotes[voterId];
    if (prevTarget && room.voteTallies[prevTarget]) {
      room.voteTallies[prevTarget] = Math.max(0, room.voteTallies[prevTarget] - 1);
    }

    room.playerVotes[voterId] = targetPlayerId;
    room.voteTallies[targetPlayerId] = (room.voteTallies[targetPlayerId] || 0) + 1;
    room.hasVoted.add(voterId);

    if (!room.privateData[voterId]) room.privateData[voterId] = {};
    room.privateData[voterId].voteSubmitted = true;
    room.privateData[voterId].votedForPlayerId = targetPlayerId;

    // Check if all active players voted
    const activeCount = room.players.filter((p) => p.connected).length;
    if (room.hasVoted.size >= activeCount) {
      this.transitionToPhase(room, 'results', broadcastState);
    } else {
      broadcastState();
    }
  }

  /**
   * Calculates round results, unmasks roles, and updates standings
   */
  private calculateResults(room: InternalRoom) {
    const roleReveals: RoleRevealInfo[] = room.players.map((player) => {
      const priv = room.privateData[player.id];
      const isSpecial = Boolean(priv?.isSpecialRole);
      return {
        playerId: player.id,
        playerName: player.name,
        playerColor: player.colorHex,
        colorIndex: player.colorIndex,
        role: priv?.role || 'Player',
        isSpecialRole: isSpecial,
        explanation: isSpecial
          ? 'Was the secret Impostor!'
          : 'Knew the secret word from the beginning.',
      };
    });

    // Find most voted player
    let maxVotes = -1;
    let mostVotedPlayerId: string | null = null;
    for (const [pId, count] of Object.entries(room.voteTallies)) {
      if (count > maxVotes) {
        maxVotes = count;
        mostVotedPlayerId = pId;
      }
    }

    const specialRolePlayer = room.players.find(
      (p) => room.privateData[p.id]?.isSpecialRole
    );
    const impostorCaught = mostVotedPlayerId === specialRolePlayer?.id;

    // Score updates
    const standings: PlayerResultStanding[] = room.players.map((player) => {
      let points = 0;
      const isImpostor = room.privateData[player.id]?.isSpecialRole;

      if (impostorCaught) {
        if (!isImpostor) points = 100;
      } else {
        if (isImpostor) points = 250;
      }

      player.score += points;

      return {
        playerId: player.id,
        playerName: player.name,
        playerColor: player.colorHex,
        colorIndex: player.colorIndex,
        pointsAdded: points,
        totalScore: player.score,
        badge: isImpostor ? 'Impostor' : undefined,
      };
    });

    // Sort by total score descending
    standings.sort((a, b) => b.totalScore - a.totalScore);

    room.results = {
      summary: impostorCaught
        ? `The crew correctly identified ${specialRolePlayer?.name || 'the Impostor'}!`
        : `${specialRolePlayer?.name || 'The Impostor'} successfully deceived everyone!`,
      roleReveals,
      standings,
      winnerTitle: impostorCaught ? 'Crew Victory' : 'Impostor Triumph',
    };
  }

  /**
   * Returns clean public state safe to broadcast to everyone in the room
   */
  public getPublicRoomState(room: InternalRoom): RoomPublicState {
    return {
      roomCode: room.code,
      hostId: room.hostId,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        colorIndex: p.colorIndex,
        colorHex: p.colorHex,
        colorName: p.colorName,
        isHost: p.isHost,
        connected: p.connected,
        score: p.score,
        sessionToken: p.sessionToken,
        joinedAt: p.joinedAt,
      })),
      phase: room.phase,
      selectedGame: room.selectedGame,
      roundNumber: room.roundNumber,
      totalRounds: room.totalRounds,
      timer: room.timer,
      phasePrompt: room.phasePrompt,
      phaseSubprompt: room.phaseSubprompt,
      hasSubmittedInput: Array.from(room.hasSubmittedInput),
      hasVoted: Array.from(room.hasVoted),
      revealedAnswers: room.revealedAnswers,
      voteTallies: room.voteTallies,
      results: room.results,
    };
  }

  /**
   * Returns private state for a specific player
   */
  public getPlayerPrivateState(
    room: InternalRoom,
    playerId: string
  ): PlayerPrivateState {
    return room.privateData[playerId] || {};
  }
}

export const roomManager = new RoomManager();
