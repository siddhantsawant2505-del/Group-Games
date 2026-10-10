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
  AtwPublicState,
  MafiaPublicState,
  GtlPublicState,
  Top100PublicState,
} from '../shared/types';
import { PLAYER_COLORS } from '../shared/theme/tokens';
import { PARTY_GAMES } from '../shared/data/games';
import {
  GtlCustomPromptInput,
  GuessTheLinkPrompt,
  buildGtlCustomPrompt,
  isBlankGtlCustomPrompt,
} from '../shared/data/guessTheLinkPrompts';
import { getRandomImpostorWord } from '../shared/data/impostorWords';
import {
  setupImpostorRound,
  recordPlayerClue,
  simulateImpostorBotClues,
  finalizeImpostorReveal,
  calculateImpostorResults,
  cleanupImpostorRound,
} from './games/impostor';
import {
  ATW_TURN_SECONDS,
  setupAvoidTheWordRound,
  beginAtwTurn,
  toggleAtwBuzz,
  resolveAtwBuzz,
  completeAtwTurn,
  hasMoreAtwTurns,
  simulateAtwBotBuzzes,
  decideAtwBotDescribeOutcome,
  calculateAtwResults,
  cleanupAvoidTheWordRound,
  AtwTurnOutcome,
} from './games/avoidTheWord';
import {
  MAFIA_DAY_SECONDS,
  MAFIA_NIGHT_SECONDS,
  setupMafiaRound,
  beginMafiaNight,
  submitMafiaNightAction,
  simulateMafiaBotNightActions,
  resolveMafiaNight,
  nightActionsPending,
  beginMafiaDay,
  resolveMafiaExile,
  checkMafiaWin,
  setMafiaWinningSide,
  simulateMafiaBotVotes,
  calculateMafiaResults,
  cleanupMafiaRound,
  getLivingPlayerIds,
  isPlayerAlive,
} from './games/mafia';
import {
  GTL_INPUT_SECONDS,
  GTL_REVEAL_SECONDS,
  GTL_GUESS_SECONDS,
  setupGtlRound,
  recordGtlResponse,
  simulateGtlBotResponses,
  finalizeGtlReveal,
  beginGtlGuessing,
  recordGtlGuess,
  simulateGtlBotGuesses,
  finalizeGtlGuesses,
  pendingGtlGuessers,
  calculateGtlResults,
  cleanupGtlRound,
} from './games/guessTheLink';
import {
  TOP100_INPUT_SECONDS,
  TOP100_REVEAL_SECONDS,
  TOP100_RANK_SECONDS,
  setupTop100Round,
  recordTop100Example,
  simulateTop100BotExamples,
  finalizeTop100Reveal,
  beginTop100Ranking,
  setTop100Order,
  finalizeTop100Order,
  calculateTop100Results,
  cleanupTop100Round,
} from './games/top100';

/** Game ids that ship with a dedicated server-side rules module. */
const IMPOSTOR_GAME_ID = 'impostor';
const AVOID_THE_WORD_GAME_ID = 'avoid-the-word';
const MAFIA_GAME_ID = 'mafia';
const GUESS_THE_LINK_GAME_ID = 'guess-the-link';
const TOP_100_GAME_ID = 'top-100';

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
  atwState: AtwPublicState | null; // Avoid the Word turn state
  mafiaState: MafiaPublicState | null; // Mafia night/day state
  gtlState: GtlPublicState | null; // Guess the Link round state
  top100State: Top100PublicState | null; // Top 100 spectrum/ranking state
  /** Host-authored Guess the Link prompt, consumed by the next round.
   *  Kept off public state so the concept never leaks before results. */
  gtlCustomPrompt: GuessTheLinkPrompt | null;
  botTimeouts: NodeJS.Timeout[]; // pending simulated-bot actions
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
    socketId: string,
    preferredColorIndex?: number
  ): { room: InternalRoom; host: InternalPlayer } {
    const code = this.generateRoomCode();
    const hostId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sessionToken = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const colorIndex =
      typeof preferredColorIndex === 'number' &&
      preferredColorIndex >= 0 &&
      preferredColorIndex < PLAYER_COLORS.length
        ? preferredColorIndex
        : 0;
    const colorToken = PLAYER_COLORS[colorIndex];

    const host: InternalPlayer = {
      id: hostId,
      name: hostName.trim() || 'Host',
      colorIndex,
      colorHex: colorToken.hex,
      colorName: colorToken.label,
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
      atwState: null,
      mafiaState: null,
      gtlState: null,
      top100State: null,
      gtlCustomPrompt: null,
      botTimeouts: [],
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
    socketId: string,
    preferredColorIndex?: number
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
    const colorIndex =
      typeof preferredColorIndex === 'number' &&
      preferredColorIndex >= 0 &&
      preferredColorIndex < PLAYER_COLORS.length
        ? preferredColorIndex
        : room.players.length % PLAYER_COLORS.length;
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
    // A queued custom concept belongs to Guess the Link only — dropping it
    // when the host switches away stops it surprising a later round.
    if (gameId !== GUESS_THE_LINK_GAME_ID) {
      room.gtlCustomPrompt = null;
    }
    return true;
  }

  /**
   * Guess the Link: the host queues a custom concept + hint angles for the
   * next round. The concept lives on the room only (never in public state)
   * and is consumed when the round is set up. An all-blank payload clears
   * it so the shipped 44-concept deck takes over.
   */
  public setGtlCustomPrompt(
    code: string,
    playerId: string,
    input: GtlCustomPromptInput
  ): { success: boolean; error?: string; prompt?: GuessTheLinkPrompt | null } {
    const room = this.getRoom(code);
    if (!room) return { success: false, error: 'Room not found.' };
    if (playerId !== room.hostId) {
      return { success: false, error: 'Only the host can set the concept.' };
    }
    if (room.phase !== 'game-select') {
      return { success: false, error: 'Set this before launching the round.' };
    }
    if (room.selectedGame?.id !== GUESS_THE_LINK_GAME_ID) {
      return { success: false, error: 'Select Guess the Link first.' };
    }

    if (isBlankGtlCustomPrompt(input)) {
      room.gtlCustomPrompt = null;
      return { success: true, prompt: null };
    }

    const result = buildGtlCustomPrompt(input);
    if (!result.ok) return { success: false, error: result.error };

    room.gtlCustomPrompt = result.prompt;
    // Echoed only to the host's own callback — the concept never broadcasts.
    return { success: true, prompt: result.prompt };
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
    this.clearBotTimeouts(room);
  }

  /**
   * Cancels every pending simulated-bot action for a room
   */
  private clearBotTimeouts(room: InternalRoom) {
    room.botTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    room.botTimeouts = [];
  }

  /**
   * Queues a delayed simulated-bot action, tracked so it can be cancelled
   * whenever the room changes phase.
   */
  private scheduleBotAction(room: InternalRoom, delayMs: number, action: () => void) {
    const timeoutId = setTimeout(() => {
      room.botTimeouts = room.botTimeouts.filter((id) => id !== timeoutId);
      action();
    }, delayMs);

    room.botTimeouts.push(timeoutId);
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
        room.atwState = null;
        room.mafiaState = null;
        room.gtlState = null;
        room.top100State = null;
        room.gtlCustomPrompt = null;
        cleanupAvoidTheWordRound(room.code);
        cleanupMafiaRound(room.code);
        cleanupGtlRound(room.code);
        cleanupTop100Round(room.code);
        break;
      }

      case 'game-select': {
        room.phasePrompt = 'Choose a Game';
        room.phaseSubprompt = 'Host picks the game collection for this round';
        break;
      }

      case 'reveal': {
        // Prepare private roles/words based on selected game
        if (room.selectedGame?.id === IMPOSTOR_GAME_ID) {
          setupImpostorRound(room);
        } else if (room.selectedGame?.id === AVOID_THE_WORD_GAME_ID) {
          setupAvoidTheWordRound(room);
        } else if (room.selectedGame?.id === MAFIA_GAME_ID) {
          setupMafiaRound(room);
        } else if (room.selectedGame?.id === GUESS_THE_LINK_GAME_ID) {
          setupGtlRound(room);
        } else if (room.selectedGame?.id === TOP_100_GAME_ID) {
          setupTop100Round(room);
        } else {
          this.setupPhaseReveal(room);
        }
        room.phasePrompt = 'Check Your Secret Role';
        room.phaseSubprompt = 'Keep your screen hidden from others!';
        this.startPhaseTimer(
          room,
          10,
          () => broadcastState(),
          () => this.transitionToPhase(room, this.phaseAfterReveal(room), broadcastState)
        );
        break;
      }

      case 'night': {
        // Mafia-specific: the Mafia pick a victim and the Detective investigates
        // while everybody else waits out the night.
        if (room.selectedGame?.id !== MAFIA_GAME_ID) {
          this.transitionToPhase(room, 'input', broadcastState);
          return;
        }

        beginMafiaNight(room);
        room.hasVoted.clear();
        room.voteTallies = {};
        room.playerVotes = {};
        simulateMafiaBotNightActions(room);

        room.phasePrompt = 'The Town Sleeps';
        room.phaseSubprompt = 'Mafia and the Detective are making their moves...';

        this.startPhaseTimer(
          room,
          MAFIA_NIGHT_SECONDS,
          () => broadcastState(),
          () => this.finishMafiaNight(room, broadcastState)
        );

        // All night actions already locked in (bot-driven): give the table a beat
        // on the sleeps screen before the sun comes up.
        if (nightActionsPending(room) === 0) {
          this.scheduleBotAction(room, 1800, () => {
            if (room.phase === 'night') this.finishMafiaNight(room, broadcastState);
          });
        }
        break;
      }

      case 'day': {
        // Mafia-specific: morning report of the overnight elimination.
        if (room.selectedGame?.id !== MAFIA_GAME_ID) {
          this.transitionToPhase(room, 'discussion', broadcastState);
          return;
        }

        beginMafiaDay(room);
        room.phasePrompt = 'Morning Report';
        room.phaseSubprompt = 'The town wakes up to last night’s news';

        this.startPhaseTimer(
          room,
          MAFIA_DAY_SECONDS,
          () => broadcastState(),
          () => this.transitionToPhase(room, 'discussion', broadcastState)
        );
        break;
      }

      case 'atw-describe': {
        // Avoid the Word replaces the single-shot input phase with a rotation of
        // live describing turns (one describer at a time, everyone else listens).
        if (room.selectedGame?.id !== AVOID_THE_WORD_GAME_ID) {
          this.transitionToPhase(room, 'input', broadcastState);
          return;
        }
        this.runAtwTurn(room, broadcastState);
        return; // runAtwTurn performs its own broadcast
      }

      case 'input': {
        const inputIsGtl = room.selectedGame?.id === GUESS_THE_LINK_GAME_ID;
        const inputIsTop100 = room.selectedGame?.id === TOP_100_GAME_ID;
        room.phasePrompt = inputIsTop100
          ? 'Write Your Example'
          : inputIsGtl
          ? 'Write Your Response'
          : 'Submit Your Clue';
        room.phaseSubprompt = inputIsTop100
          ? 'A short scenario that fits your secret number on the spectrum'
          : inputIsGtl
          ? 'One word or a short phrase inspired by your private hint'
          : 'Enter a one-word clue before the timer expires';
        room.hasSubmittedInput.clear();

        // Auto-populate bot answers if any bots are in room
        if (room.selectedGame?.id === IMPOSTOR_GAME_ID) {
          simulateImpostorBotClues(room);
        } else if (inputIsGtl) {
          simulateGtlBotResponses(room);
        } else if (inputIsTop100) {
          simulateTop100BotExamples(room);
        } else {
          this.simulateBotInputs(room);
        }

        this.startPhaseTimer(
          room,
          inputIsTop100 ? TOP100_INPUT_SECONDS : inputIsGtl ? GTL_INPUT_SECONDS : 20,
          () => broadcastState(),
          () => {
            if (room.selectedGame?.id === IMPOSTOR_GAME_ID) {
              finalizeImpostorReveal(room);
            } else if (room.selectedGame?.id === GUESS_THE_LINK_GAME_ID) {
              finalizeGtlReveal(room);
            } else if (room.selectedGame?.id === TOP_100_GAME_ID) {
              finalizeTop100Reveal(room);
            }
            this.transitionToPhase(room, 'reveal-answers', broadcastState);
          }
        );
        break;
      }

      case 'reveal-answers': {
        const revealIsGtl = room.selectedGame?.id === GUESS_THE_LINK_GAME_ID;
        const revealIsTop100 = room.selectedGame?.id === TOP_100_GAME_ID;
        room.phasePrompt = revealIsGtl
          ? 'The Link Board'
          : revealIsTop100
          ? 'The Example Board'
          : 'Simultaneous Reveal';
        room.phaseSubprompt = revealIsGtl
          ? 'Every response, shuffled — what single concept ties them together?'
          : revealIsTop100
          ? 'Every example, shuffled — the secret numbers stay hidden for now'
          : 'Review every player’s clue in randomized order';
        if (room.selectedGame?.id === 'impostor') {
          finalizeImpostorReveal(room);
        } else if (revealIsGtl) {
          finalizeGtlReveal(room);
        } else if (revealIsTop100) {
          finalizeTop100Reveal(room);
        } else {
          this.prepareRevealedAnswers(room);
        }
        this.startPhaseTimer(
          room,
          revealIsGtl ? GTL_REVEAL_SECONDS : revealIsTop100 ? TOP100_REVEAL_SECONDS : 15,
          () => broadcastState(),
          () =>
            this.transitionToPhase(
              room,
              revealIsGtl ? 'guess' : revealIsTop100 ? 'rank' : 'discussion',
              broadcastState
            )
        );
        break;
      }

      case 'rank': {
        // Top 100: the host drags the examples into ascending numeric order
        // (host-authoritative) while everyone else watches live.
        if (room.selectedGame?.id !== TOP_100_GAME_ID) {
          this.transitionToPhase(room, 'results', broadcastState);
          return;
        }

        beginTop100Ranking(room);
        room.phasePrompt = 'Put the Examples in Order';
        room.phaseSubprompt = 'Host drags the cards — everyone else watches live';

        this.startPhaseTimer(
          room,
          TOP100_RANK_SECONDS,
          () => broadcastState(),
          () => this.transitionToPhase(room, 'results', broadcastState)
        );
        break;
      }

      case 'guess': {
        // Guess the Link: everyone locks in a guess at the hidden concept at the
        // same time, so simultaneous guessing works exactly like voting.
        if (room.selectedGame?.id !== GUESS_THE_LINK_GAME_ID) {
          this.transitionToPhase(room, 'results', broadcastState);
          return;
        }

        room.phasePrompt = 'Guess the Concept';
        room.phaseSubprompt = 'Lock in the link that ties every response together';
        beginGtlGuessing(room);
        simulateGtlBotGuesses(room);

        this.startPhaseTimer(
          room,
          GTL_GUESS_SECONDS,
          () => broadcastState(),
          () => this.finishGtlGuessing(room, broadcastState)
        );

        // A room where only bots still owe a guess can resolve immediately.
        if (pendingGtlGuessers(room).length === 0) {
          this.finishGtlGuessing(room, broadcastState);
          return;
        }
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
        if (room.selectedGame?.id === MAFIA_GAME_ID) {
          simulateMafiaBotVotes(room);
        } else {
          this.simulateBotVotes(room);
        }

        this.startPhaseTimer(
          room,
          25,
          () => broadcastState(),
          () =>
            room.selectedGame?.id === MAFIA_GAME_ID
              ? this.finishMafiaTrial(room, broadcastState)
              : this.transitionToPhase(room, 'results', broadcastState)
        );

        // Mafia: if only bots are left to vote, the trial can resolve right away.
        if (
          room.selectedGame?.id === MAFIA_GAME_ID &&
          getLivingPlayerIds(room).every((id) => room.hasVoted.has(id))
        ) {
          this.finishMafiaTrial(room, broadcastState);
          return;
        }
        break;
      }

      case 'results': {
        if (room.selectedGame?.id === IMPOSTOR_GAME_ID) {
          calculateImpostorResults(room);
        } else if (room.selectedGame?.id === AVOID_THE_WORD_GAME_ID) {
          calculateAtwResults(room);
        } else if (room.selectedGame?.id === MAFIA_GAME_ID) {
          calculateMafiaResults(room);
        } else if (room.selectedGame?.id === GUESS_THE_LINK_GAME_ID) {
          calculateGtlResults(room);
        } else if (room.selectedGame?.id === TOP_100_GAME_ID) {
          calculateTop100Results(room);
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

      case 'post-game': {
        room.phasePrompt = 'Game Over';
        room.phaseSubprompt = 'Final Session Leaderboard';
        this.clearPhaseTimer(room);
        break;
      }
    }

    broadcastState();
  }

  /**
   * Games with a dedicated engine leave the reveal phase into their own phase.
   */
  private phaseAfterReveal(room: InternalRoom): GamePhase {
    if (room.selectedGame?.id === AVOID_THE_WORD_GAME_ID) return 'atw-describe';
    if (room.selectedGame?.id === MAFIA_GAME_ID) return 'night';
    return 'input';
  }

  /**
   * Mafia: scores the night, then either ends the game or wakes the town up.
   */
  private finishMafiaNight(room: InternalRoom, broadcastState: () => void) {
    if (room.phase !== 'night') return;
    if (room.selectedGame?.id !== MAFIA_GAME_ID) return;

    this.clearBotTimeouts(room);
    resolveMafiaNight(room);

    const winningSide = checkMafiaWin(room);
    if (winningSide) {
      setMafiaWinningSide(room, winningSide);
      this.transitionToPhase(room, 'results', broadcastState);
      return;
    }

    this.transitionToPhase(room, 'day', broadcastState);
  }

  /**
   * Mafia: resolves the day's exile trial, then either ends the game or
   * loops the room back into another night.
   */
  private finishMafiaTrial(room: InternalRoom, broadcastState: () => void) {
    if (room.phase !== 'vote') return;
    if (room.selectedGame?.id !== MAFIA_GAME_ID) return;

    resolveMafiaExile(room);

    const winningSide = checkMafiaWin(room);
    if (winningSide) {
      setMafiaWinningSide(room, winningSide);
      this.transitionToPhase(room, 'results', broadcastState);
      return;
    }

    this.transitionToPhase(room, 'night', broadcastState);
  }

  /**
   * Guess the Link: closes guessing once every player has locked in (or the
   * timer runs out) and moves straight to the concept reveal.
   */
  private finishGtlGuessing(room: InternalRoom, broadcastState: () => void) {
    if (room.phase !== 'guess') return;
    if (room.selectedGame?.id !== GUESS_THE_LINK_GAME_ID) return;

    this.clearBotTimeouts(room);
    finalizeGtlGuesses(room);
    this.transitionToPhase(room, 'results', broadcastState);
  }

  /**
   * Avoid the Word: runs the current describing turn and arms the turn timer.
   * Bots are simulated because they cannot actually talk out loud.
   */
  private runAtwTurn(room: InternalRoom, broadcastState: () => void) {
    const info = beginAtwTurn(room);
    if (!info) {
      this.transitionToPhase(room, 'results', broadcastState);
      return;
    }

    room.phasePrompt = `${info.describerName} is Describing`;
    room.phaseSubprompt = `Turn ${info.turnNumber} of ${info.totalTurns} — buzz the second a taboo word slips!`;

    this.startPhaseTimer(
      room,
      ATW_TURN_SECONDS,
      () => broadcastState(),
      () => this.finishAtwTurn(room, 'timeout', broadcastState)
    );

    const describer = room.players.find((p) => p.id === info.describerId);

    if (describer?.isBot) {
      // A bot turn resolves itself after a short beat so the room can follow along.
      this.scheduleBotAction(room, 4000, () => {
        if (!this.isActiveAtwTurn(room, info.describerId, info.turnNumber)) return;
        const outcome = decideAtwBotDescribeOutcome();
        if (outcome === 'buzzed') {
          simulateAtwBotBuzzes(room, true);
        }
        this.finishAtwTurn(room, outcome, broadcastState);
      });
    } else {
      // Bot listeners may call out a slip partway through a human turn.
      this.scheduleBotAction(room, 12000, () => {
        if (!this.isActiveAtwTurn(room, info.describerId, info.turnNumber)) return;
        const buzzes = simulateAtwBotBuzzes(room);
        if (buzzes === 0) return;
        if (room.atwState?.buzzConfirmed) {
          this.finishAtwTurn(room, 'buzzed', broadcastState);
          return;
        }
        broadcastState();
      });
    }

    broadcastState();
  }

  /**
   * Avoid the Word: scores the active turn and moves on to the next describer.
   */
  private finishAtwTurn(
    room: InternalRoom,
    outcome: AtwTurnOutcome,
    broadcastState: () => void
  ) {
    if (room.phase !== 'atw-describe') return;

    this.clearBotTimeouts(room);
    completeAtwTurn(room, outcome);

    if (hasMoreAtwTurns(room)) {
      this.runAtwTurn(room, broadcastState);
    } else {
      this.transitionToPhase(room, 'results', broadcastState);
    }
  }

  /**
   * Guards late bot actions so they never fire against a later turn.
   */
  private isActiveAtwTurn(
    room: InternalRoom,
    describerId: string,
    turnNumber: number
  ): boolean {
    return (
      room.phase === 'atw-describe' &&
      room.atwState?.describerPlayerId === describerId &&
      room.atwState?.turnNumber === turnNumber
    );
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
    } else if (room.selectedGame?.id === GUESS_THE_LINK_GAME_ID) {
      recordGtlResponse(room, playerId, answer);
    } else if (room.selectedGame?.id === TOP_100_GAME_ID) {
      recordTop100Example(room, playerId, answer);
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
      } else if (room.selectedGame?.id === GUESS_THE_LINK_GAME_ID) {
        finalizeGtlReveal(room);
      } else if (room.selectedGame?.id === TOP_100_GAME_ID) {
        finalizeTop100Reveal(room);
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

    // Guard: no player may vote for themselves
    if (voterId === targetPlayerId) return;

    // Mafia: the dead neither vote nor get exiled.
    if (room.selectedGame?.id === MAFIA_GAME_ID) {
      if (!isPlayerAlive(room, voterId)) return;
      if (!isPlayerAlive(room, targetPlayerId)) return;
    }

    // Guard: the impostor may not vote for themselves
    // (redundant with the above but explicit for clarity)
    const voterIsImpostor = Boolean(room.privateData[voterId]?.isSpecialRole);
    if (voterIsImpostor && targetPlayerId === voterId) return;

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

    // Check if all active players voted (Mafia: only the living hold a vote)
    const voterPool =
      room.selectedGame?.id === MAFIA_GAME_ID
        ? getLivingPlayerIds(room)
        : room.players.filter((p) => p.connected).map((p) => p.id);

    if (voterPool.every((id) => room.hasVoted.has(id))) {
      if (room.selectedGame?.id === MAFIA_GAME_ID) {
        this.finishMafiaTrial(room, broadcastState);
      } else {
        this.transitionToPhase(room, 'results', broadcastState);
      }
    } else {
      broadcastState();
    }
  }

  /**
   * Mafia: a night actor locks in a target. The night resolves once every
   * Mafia member and the Detective are done.
   */
  public submitMafiaNightTarget(
    room: InternalRoom,
    playerId: string,
    targetPlayerId: string,
    broadcastState: () => void
  ) {
    if (room.phase !== 'night') return;

    const outcome = submitMafiaNightAction(room, playerId, targetPlayerId);
    if (!outcome.accepted) return;

    if (outcome.complete) {
      this.finishMafiaNight(room, broadcastState);
      return;
    }

    broadcastState();
  }

  /**
   * Mafia: host skip that resolves the night early.
   */
  public hostResolveMafiaNight(room: InternalRoom, playerId: string, broadcastState: () => void) {
    if (room.phase !== 'night') return;
    if (playerId !== room.hostId) return;

    this.finishMafiaNight(room, broadcastState);
  }

  /**
   * Mafia: host skip that resolves the exile trial early.
   */
  public hostResolveMafiaTrial(room: InternalRoom, playerId: string, broadcastState: () => void) {
    if (room.phase !== 'vote') return;
    if (playerId !== room.hostId) return;

    this.finishMafiaTrial(room, broadcastState);
  }

  /**
   * Avoid the Word: toggles a listener's buzz on the active describer.
   * A strict majority auto-confirms and ends the turn immediately.
   */
  public submitAtwBuzz(room: InternalRoom, playerId: string, broadcastState: () => void) {
    if (room.phase !== 'atw-describe') return;

    const outcome = toggleAtwBuzz(room, playerId);
    if (!outcome.accepted) return;

    if (outcome.confirmed) {
      this.finishAtwTurn(room, 'buzzed', broadcastState);
      return;
    }

    broadcastState();
  }

  /**
   * Avoid the Word: host override on a pending buzz.
   * confirm=true ends the turn as a failure, confirm=false dismisses the buzzes.
   */
  public resolveAtwBuzz(
    room: InternalRoom,
    playerId: string,
    confirm: boolean,
    broadcastState: () => void
  ) {
    if (room.phase !== 'atw-describe') return;
    if (playerId !== room.hostId) return;

    const endsTurn = resolveAtwBuzz(room, confirm);
    if (endsTurn) {
      this.finishAtwTurn(room, 'buzzed', broadcastState);
      return;
    }

    broadcastState();
  }

  /**
   * Avoid the Word: the describer (or host) ends the active turn early.
   */
  public endAtwTurn(room: InternalRoom, playerId: string, broadcastState: () => void) {
    if (room.phase !== 'atw-describe') return;

    const describerId = room.atwState?.describerPlayerId;
    const isDescriber = Boolean(describerId) && playerId === describerId;
    if (!isDescriber && playerId !== room.hostId) return;

    // A confirmed buzz still fails the turn; an early stop otherwise counts as done.
    this.finishAtwTurn(room, room.atwState?.buzzConfirmed ? 'buzzed' : 'timeout', broadcastState);
  }

  /**
   * Guess the Link: a player locks in their guess at the hidden concept.
   * The guess stays private until results.
   */
  public submitGtlGuess(
    room: InternalRoom,
    playerId: string,
    guess: string,
    broadcastState: () => void
  ) {
    if (room.phase !== 'guess') return;
    if (room.selectedGame?.id !== GUESS_THE_LINK_GAME_ID) return;

    const outcome = recordGtlGuess(room, playerId, guess);
    if (!outcome.accepted) return;

    if (outcome.pendingPlayerIds.length === 0) {
      this.finishGtlGuessing(room, broadcastState);
      return;
    }

    broadcastState();
  }

  /**
   * Top 100: the host pushes their live drag order. Host-only, rank phase only,
   * and rejected unless it is a complete permutation of the board.
   */
  public submitTop100Order(
    room: InternalRoom,
    playerId: string,
    orderedPlayerIds: string[],
    broadcastState: () => void
  ) {
    if (room.phase !== 'rank') return;
    if (room.selectedGame?.id !== TOP_100_GAME_ID) return;
    if (playerId !== room.hostId) return;
    if (!Array.isArray(orderedPlayerIds)) return;

    const outcome = setTop100Order(room, orderedPlayerIds.map((id) => String(id)));
    if (!outcome.accepted) return;

    broadcastState();
  }

  /**
   * Top 100: host locks the order in and jumps straight to the results reveal.
   */
  public hostLockTop100Order(room: InternalRoom, playerId: string, broadcastState: () => void) {
    if (room.phase !== 'rank') return;
    if (room.selectedGame?.id !== TOP_100_GAME_ID) return;
    if (playerId !== room.hostId) return;

    this.clearBotTimeouts(room);
    finalizeTop100Order(room);
    this.transitionToPhase(room, 'results', broadcastState);
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
        // Crew members only score if they personally voted for the impostor
        if (!isImpostor) {
          const votedFor = room.playerVotes[player.id];
          if (votedFor === specialRolePlayer?.id) {
            points = 100;
          }
        }
        // Impostor gets 0 points when caught — no change needed (points stays 0)
      } else {
        // Impostor successfully escaped — they score
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
      atwState: room.atwState,
      mafiaState: room.mafiaState,
      gtlState: room.gtlState,
      top100State: room.top100State,
      gtlCustomReady: Boolean(room.gtlCustomPrompt),
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
