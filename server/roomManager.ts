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
  AvoidPublicState,
  AvoidSettings,
  MafiaPublicState,
  GtlPublicState,
  Top100PublicState,
  RevCatPublicState,
  PlayMode,
  Team,
  TeamStanding,
} from '../shared/types';
import { MAX_ROUNDS, MIN_ROUNDS } from '../shared/types';
import {
  buildTeams,
  clampTeamCount,
  DEFAULT_TEAM_COUNT,
  sanitizeTeamName,
} from '../shared/data/teams';
import { awardPoints, recomputeTeamScores as recomputeTeamScoreTotals, ScoreLogEntry } from './scoring';
import { PLAYER_COLORS } from '../shared/theme/tokens';
import { PARTY_GAMES } from '../shared/data/games';
import {
  GtlCustomPromptInput,
  GuessTheLinkPrompt,
  buildGtlCustomPrompt,
  isBlankGtlCustomPrompt,
} from '../shared/data/guessTheLinkPrompts';
import {
  DEFAULT_AVOID_SETTINGS,
  DEFAULT_IMPOSTOR_SETTINGS,
  DEFAULT_TOP100_SETTINGS,
  GameSettings,
  TOP100_SETTINGS_LIMITS,
  Top100Settings,
} from '../shared/types';
import { TOP100_CATEGORY_IDS } from '../shared/data/top100Categories';
import { sanitizeTheme } from './content/types';
import { prefetchWordContent, randomCorpusWord, wordProvider } from './content/wordProvider';
import { isAiAvailable, prefetchQuestionContent, questionProvider, releaseRoomContent } from './content';
import {
  setupImpostorRound,
  recordPlayerClue,
  simulateImpostorBotClues,
  finalizeImpostorReveal,
  calculateImpostorResults,
  cleanupImpostorRound,
  QUESTION_INPUT_SECONDS,
  setupImpostorQuestionRound,
  recordImpostorQuestionAnswer,
  simulateImpostorQuestionBots,
  finalizeImpostorQuestionReveal,
  calculateImpostorQuestionResults,
  cleanupImpostorQuestionRound,
} from './games/impostor';
import {
  ATW_SETTINGS_LIMITS,
  advanceAvoidTurn,
  applyAvoidEliminations,
  beginAvoidAnchorPhase,
  beginAvoidReveal,
  beginAvoidTurn,
  calculateAvoidResults,
  checkAvoidGameOver,
  cleanupAvoidTheWordRound,
  getAvoidRound,
  hasMoreAvoidTurns,
  nextAvoidTurnPlayerId,
  pickAvoidBotAnswer,
  readAvoidSettings,
  recordAvoidAnswer,
  recordAvoidSkip,
  setAvoidOverrule,
  setupAvoidRound,
  syncAvoidPrivateState,
} from './games/avoidTheWord';
import { avoidQuestionProvider } from './content/avoidQuestionProvider';
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
  TOP100_OVERRULE_SECONDS,
  TOP100_QUESTION_SECONDS,
  addTop100Suggestion,
  applyTop100Scores,
  buildTop100Results,
  cleanupTop100Round,
  effectiveTop100GuessSeconds,
  finalizeTop100Guesses,
  getTop100Round,
  pendingTop100Guessers,
  readTop100Settings,
  recordTop100Guess,
  setTop100Overrule,
  setupTop100Round,
  simulateTop100BotGuesses,
  simulateTop100BotSuggestions,
  syncTop100PrivateState,
  teamSuggestions,
} from './games/top100';
import { top100Provider } from './content/top100Provider';
import {
  RC_INPUT_SECONDS,
  RC_REVEAL_SECONDS,
  setupReverseCategoriesRound,
  recordRevCatCategory,
  simulateRevCatBotCategories,
  finalizeRevCatReveal,
  calculateReverseCategoriesResults,
  cleanupRevCatRound,
} from './games/reverseCategories';

/**
 * Central scoring entry point, re-exported here because awardPoints is the one
 * sanctioned way for any game to change a score (see docs/GAME_rules.md).
 */
export { awardPoints } from './scoring';

/**
 * Clamps a host-authored Top 100 settings patch into its legal ranges.
 * Settings are public strategy (rounds, timers, duplicate policy, filters).
 */
function sanitizeTop100SettingsPatch(
  patch: Partial<Top100Settings>,
  current: Top100Settings
): Top100Settings {
  const clamp = (value: unknown, min: number, max: number, fallback: number) => {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  const incoming = patch || {};
  return {
    roundCount: clamp(
      incoming.roundCount,
      TOP100_SETTINGS_LIMITS.roundCount.min,
      TOP100_SETTINGS_LIMITS.roundCount.max,
      current.roundCount
    ),
    guessSeconds: clamp(
      incoming.guessSeconds,
      TOP100_SETTINGS_LIMITS.guessSeconds.min,
      TOP100_SETTINGS_LIMITS.guessSeconds.max,
      current.guessSeconds
    ),
    duplicatePolicy:
      incoming.duplicatePolicy === 'zero' || incoming.duplicatePolicy === 'allow'
        ? incoming.duplicatePolicy
        : current.duplicatePolicy,
    region:
      incoming.region === 'global' || incoming.region === 'india' || incoming.region === 'mixed'
        ? incoming.region
        : current.region,
    categories: Array.isArray(incoming.categories)
      ? readTop100CategoriesPatch(incoming.categories)
      : current.categories,
  };
}

/** Keeps only category ids the shipped bank actually uses. */
function readTop100CategoriesPatch(value: unknown[]): string[] {
  const known = new Set(TOP100_CATEGORY_IDS);
  return [...new Set(value.map((entry) => String(entry)).filter((entry) => known.has(entry)))];
}

/**
 * Clamps a host-authored Avoid the Word settings patch into its legal ranges.
 * Settings are public strategy (durations, cap, tone), never round secrets.
 */
function sanitizeAvoidSettingsPatch(
  patch: Partial<AvoidSettings>,
  current: AvoidSettings
): AvoidSettings {
  const clamp = (value: unknown, min: number, max: number, fallback: number) => {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  return {
    anchorSeconds: clamp(
      patch.anchorSeconds,
      ATW_SETTINGS_LIMITS.anchorSeconds.min,
      ATW_SETTINGS_LIMITS.anchorSeconds.max,
      current.anchorSeconds
    ),
    turnSeconds: clamp(
      patch.turnSeconds,
      ATW_SETTINGS_LIMITS.turnSeconds.min,
      ATW_SETTINGS_LIMITS.turnSeconds.max,
      current.turnSeconds
    ),
    roundCap: clamp(
      patch.roundCap,
      ATW_SETTINGS_LIMITS.roundCap.min,
      ATW_SETTINGS_LIMITS.roundCap.max,
      current.roundCap
    ),
    tone: patch.tone === 'spicy' || patch.tone === 'clean' ? patch.tone : current.tone,
  };
}

/** Rooms with no connected player are dropped after this much inactivity. */
export const ROOM_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** Game ids that ship with a dedicated server-side rules module. */
const IMPOSTOR_GAME_ID = 'impostor';
const AVOID_THE_WORD_GAME_ID = 'avoid-the-word';
const MAFIA_GAME_ID = 'mafia';
const GUESS_THE_LINK_GAME_ID = 'guess-the-link';
const TOP_100_GAME_ID = 'top-100';
const REVERSE_CATEGORIES_GAME_ID = 'reverse-categories';

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
  avoidState: AvoidPublicState | null; // Avoid the Word round state
  mafiaState: MafiaPublicState | null; // Mafia night/day state
  gtlState: GtlPublicState | null; // Guess the Link round state
  top100State: Top100PublicState | null; // Top 100 hidden-list state (never the list itself)
  revCatState: RevCatPublicState | null; // Reverse Categories items/board state
  impostorQuestionState: RoomPublicState['impostorQuestionState']; // Question mode only
  /** Host settings per game. Public: they never carry round secrets. */
  gameSettings: GameSettings;
  /** Room-wide play mode. 'solo' is exactly the pre-team behaviour. */
  playMode: PlayMode;
  /** Room teams. Empty in solo mode. */
  teams: Team[];
  /** Bounded audit trail of every awardPoints() call this room made. */
  scoreLog: ScoreLogEntry[];
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
      avoidState: null,
      mafiaState: null,
      gtlState: null,
      top100State: null,
      revCatState: null,
      impostorQuestionState: null,
      gameSettings: {
        impostor: { ...DEFAULT_IMPOSTOR_SETTINGS },
        avoidTheWord: { ...DEFAULT_AVOID_SETTINGS },
        top100: { ...DEFAULT_TOP100_SETTINGS },
      },
      playMode: 'solo',
      teams: [],
      scoreLog: [],
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
    // Team mode: players who join after teams exist land on the smallest team.
    this.assignPlayerToSmallestTeam(room, newPlayer);
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
    this.assignPlayerToSmallestTeam(room, bot);
    return { success: true, bot };
  }

  /**
   * Handles player disconnection
   */
  public handleDisconnect(
    socketId: string,
    broadcastState?: () => void
  ): {
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

        // Avoid the Word: a player dropping during their own answer window is
        // treated as a timeout (skip), so the round never stalls on a ghost.
        this.resolveAvoidDisconnect(room, player.id, broadcastState);

        return { room, player };
      }
    }
    return {};
  }

  /**
   * Avoid the Word: resolves an open answer window when its player drops out.
   */
  private resolveAvoidDisconnect(
    room: InternalRoom,
    playerId: string,
    broadcastState?: () => void
  ) {
    if (room.selectedGame?.id !== AVOID_THE_WORD_GAME_ID) return;
    const phase = room.phase;
    if (phase !== 'avoid-anchor' && phase !== 'avoid-turn') return;

    const state = getAvoidRound(room.code);
    if (!state) return;

    const activeId = phase === 'avoid-anchor' ? state.anchorId : nextAvoidTurnPlayerId(state);
    if (activeId !== playerId) return;

    const notify = broadcastState || (() => undefined);
    this.clearBotTimeouts(room);
    recordAvoidSkip(room, playerId, phase);

    if (phase === 'avoid-anchor') {
      this.transitionToPhase(room, 'avoid-turn', notify);
      return;
    }

    advanceAvoidTurn(state);
    this.advanceAvoid(room, notify);
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
   * Applies a host-authored settings patch for the selected game.
   * Settings are strategy, not secrets, so they live in the public room state
   * and are only editable before a round starts (lobby / game-select).
   */
  public setGameSettings(
    code: string,
    playerId: string,
    patch: {
      impostor?: {
        mode?: string;
        difficulty?: string;
        tone?: string;
        theme?: string;
      };
      avoidTheWord?: Partial<AvoidSettings>;
      top100?: Partial<Top100Settings>;
    }
  ): { success: boolean; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { success: false, error: 'Room not found.' };
    if (playerId !== room.hostId) return { success: false, error: 'Only the host can change settings.' };
    if (room.phase !== 'lobby' && room.phase !== 'game-select') {
      return { success: false, error: 'Settings are locked once a round starts.' };
    }

    const current = room.gameSettings.impostor;
    const incoming = patch?.impostor || {};

    const mode = incoming.mode === 'question' || incoming.mode === 'word' ? incoming.mode : current.mode;
    const difficulty =
      incoming.difficulty === 'medium' || incoming.difficulty === 'any' || incoming.difficulty === 'easy'
        ? incoming.difficulty
        : current.difficulty;
    const tone =
      incoming.tone === 'spicy' || incoming.tone === 'clean' ? incoming.tone : current.tone;
    const theme =
      typeof incoming.theme === 'string'
        ? sanitizeTheme(incoming.theme)
        : typeof current.theme === 'string'
        ? current.theme
        : '';

    room.gameSettings = {
      ...room.gameSettings,
      impostor: { mode, difficulty, tone, ...(theme ? { theme } : {}) },
      avoidTheWord: sanitizeAvoidSettingsPatch(
        patch?.avoidTheWord || {},
        room.gameSettings.avoidTheWord
      ),
      top100: sanitizeTop100SettingsPatch(patch?.top100 || {}, room.gameSettings.top100),
    };
    room.lastActivityAt = Date.now();
    return { success: true };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Room play mode (solo / team)
  // ───────────────────────────────────────────────────────────────────────────

  /** Settings are only editable before a round starts. */
  private teammatesEditable(room: InternalRoom): boolean {
    return room.phase === 'lobby' || room.phase === 'game-select';
  }

  /**
   * Team membership is authoritative on `player.teamId`; `team.memberIds` is
   * rebuilt from it in join order, dropping ids that no longer exist. Totals
   * are re-derived too, so a switch carries a player's points to their new team.
   * Unassigned players are left alone here — seatUnassignedPlayers() deals them.
   */
  private syncTeamMembership(room: InternalRoom) {
    if (room.playMode !== 'team' || room.teams.length === 0) return;
    const validTeamIds = new Set(room.teams.map((t) => t.id));
    room.teams.forEach((team) => {
      team.memberIds = [];
    });
    room.players.forEach((player) => {
      if (player.teamId && !validTeamIds.has(player.teamId)) {
        player.teamId = undefined;
      }
      const team = room.teams.find((t) => t.id === player.teamId);
      if (team) team.memberIds.push(player.id);
    });
    this.recomputeTeamScores(room);
  }

  /**
   * Seats anyone still without a team (a fresh joiner, or a player whose team
   * was removed) on the smallest team, one at a time so the sizes stay even.
   */
  private seatUnassignedPlayers(room: InternalRoom): void {
    if (room.playMode !== 'team' || room.teams.length === 0) return;
    for (const player of room.players) {
      if (player.teamId) continue;
      const target = this.smallestTeam(room);
      if (!target) return;
      player.teamId = target.id;
      target.memberIds.push(player.id);
    }
  }

  private smallestTeam(room: InternalRoom): Team | undefined {
    let smallest: Team | undefined;
    for (const team of room.teams) {
      if (!smallest || team.memberIds.length < smallest.memberIds.length) smallest = team;
    }
    return smallest;
  }

  /** Assigns a newly joined player (or bot) to the smallest team. */
  private assignPlayerToSmallestTeam(room: InternalRoom, player: InternalPlayer) {
    if (room.playMode !== 'team' || room.teams.length === 0) return;
    // Rebuild the existing split first so the newcomer is measured against the
    // real sizes (the just-added player has no team yet, so it is not counted).
    this.syncTeamMembership(room);
    this.seatUnassignedPlayers(room);
  }

  /**
   * Switches the room between solo and team play. Scoring stops being
   * individual-only the moment team mode is on: totals already earned are
   * folded into the teams, so the leaderboard is never inconsistent.
   */
  public setPlayMode(
    code: string,
    playerId: string,
    mode: PlayMode
  ): { success: boolean; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { success: false, error: 'Room not found.' };
    if (playerId !== room.hostId) return { success: false, error: 'Only the host can change the room mode.' };
    if (!this.teammatesEditable(room)) {
      return { success: false, error: 'Play mode is locked once a round starts.' };
    }
    if (mode !== 'solo' && mode !== 'team') {
      return { success: false, error: 'Unknown play mode.' };
    }
    if (mode === room.playMode) return { success: true };

    if (mode === 'solo') {
      room.playMode = 'solo';
      room.teams = [];
      room.players.forEach((player) => {
        player.teamId = undefined;
      });
      room.lastActivityAt = Date.now();
      return { success: true };
    }

    room.playMode = 'team';
    room.teams = buildTeams(DEFAULT_TEAM_COUNT);
    // Deal everyone (and each team's share of the running total) out evenly.
    room.players.forEach((player, index) => {
      player.teamId = room.teams[index % room.teams.length].id;
    });
    this.syncTeamMembership(room);
    this.recomputeTeamScores(room);
    room.lastActivityAt = Date.now();
    return { success: true };
  }

  /** Grows or shrinks the team list (2-4). Dropped teams hand their players over. */
  public setTeamCount(
    code: string,
    playerId: string,
    count: number
  ): { success: boolean; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { success: false, error: 'Room not found.' };
    if (playerId !== room.hostId) return { success: false, error: 'Only the host can change the teams.' };
    if (!this.teammatesEditable(room)) {
      return { success: false, error: 'Teams are locked once a round starts.' };
    }
    if (room.playMode !== 'team') {
      return { success: false, error: 'Turn team mode on first.' };
    }

    const target = clampTeamCount(count);
    if (target === room.teams.length) return { success: true };

    if (target > room.teams.length) {
      const fresh = buildTeams(target).slice(room.teams.length);
      room.teams = [...room.teams, ...fresh];
    } else {
      room.teams = room.teams.slice(0, target);
    }
    // Members of a removed team are reseated on the smallest surviving team.
    this.syncTeamMembership(room);
    this.seatUnassignedPlayers(room);
    this.recomputeTeamScores(room);
    room.lastActivityAt = Date.now();
    return { success: true };
  }

  /** A player taps a team to join or switch (solo rooms have no teams). */
  public joinTeam(
    code: string,
    playerId: string,
    teamId: string
  ): { success: boolean; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.playMode !== 'team') return { success: false, error: 'This room is playing solo.' };
    if (!this.teammatesEditable(room)) {
      return { success: false, error: 'Teams are locked once a round starts.' };
    }
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found.' };
    const team = room.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: 'Team not found.' };
    if (player.teamId === teamId) return { success: true };

    player.teamId = teamId;
    this.syncTeamMembership(room);
    room.lastActivityAt = Date.now();
    return { success: true };
  }

  public renameTeam(
    code: string,
    playerId: string,
    teamId: string,
    name: string
  ): { success: boolean; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { success: false, error: 'Room not found.' };
    if (playerId !== room.hostId) return { success: false, error: 'Only the host can rename teams.' };
    const team = room.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: 'Team not found.' };
    team.name = sanitizeTeamName(name, team.name);
    room.lastActivityAt = Date.now();
    return { success: true };
  }

  /**
   * Auto-balance: keeps the current team order but refills the smallest team
   * first, so sizes never differ by more than one.
   */
  public balanceTeams(code: string, playerId: string): { success: boolean; error?: string } {
    return this.distributeTeams(code, playerId, false);
  }

  /** Shuffle teams: random draw across the existing teams, same even split. */
  public shuffleTeams(code: string, playerId: string): { success: boolean; error?: string } {
    return this.distributeTeams(code, playerId, true);
  }

  private distributeTeams(
    code: string,
    playerId: string,
    shuffle: boolean
  ): { success: boolean; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { success: false, error: 'Room not found.' };
    if (playerId !== room.hostId) {
      return { success: false, error: 'Only the host can sort the teams.' };
    }
    if (room.playMode !== 'team') return { success: false, error: 'This room is playing solo.' };
    if (!this.teammatesEditable(room)) {
      return { success: false, error: 'Teams are locked once a round starts.' };
    }

    const players = [...room.players];
    if (shuffle) {
      for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
      }
    }

    room.teams.forEach((team) => {
      team.memberIds = [];
    });
    players.forEach((player, index) => {
      const team = room.teams[index % room.teams.length];
      player.teamId = team.id;
      team.memberIds.push(player.id);
    });
    this.recomputeTeamScores(room);
    room.lastActivityAt = Date.now();
    return { success: true };
  }

  /** Host control for how many rounds a session runs (1-7). */
  public setRoundCount(
    code: string,
    playerId: string,
    rounds: number
  ): { success: boolean; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { success: false, error: 'Room not found.' };
    if (playerId !== room.hostId) return { success: false, error: 'Only the host can change the rounds.' };
    if (!this.teammatesEditable(room)) {
      return { success: false, error: 'Round count is locked once a round starts.' };
    }
    const parsed = Math.floor(Number(rounds));
    if (!Number.isFinite(parsed)) return { success: false, error: 'Unknown round count.' };
    room.totalRounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, parsed));
    room.lastActivityAt = Date.now();
    return { success: true };
  }

  /**
   * Team totals are derived from member scores plus any team-only awards
   * (`awardTeamPoints()`, e.g. Top 100), so they stay correct even when a player
   * switches teams after scoring.
   */
  private recomputeTeamScores(room: InternalRoom) {
    recomputeTeamScoreTotals(room);
  }

  /** Builds the round's team leaderboard (team mode only). */
  private buildTeamStandings(room: InternalRoom, standings: PlayerResultStanding[]): TeamStanding[] {
    this.recomputeTeamScores(room);
    const byId = new Map(standings.map((entry) => [entry.playerId, entry]));
    const rows = room.teams.map((team) => {
      const members = team.memberIds
        .map((id) => byId.get(id))
        .filter((entry): entry is PlayerResultStanding => Boolean(entry))
        .map((entry) => ({
          playerId: entry.playerId,
          playerName: entry.playerName,
          colorIndex: entry.colorIndex,
          pointsAdded: entry.pointsAdded,
          totalScore: entry.totalScore,
        }))
        .sort((a, b) => b.totalScore - a.totalScore);
      return {
        teamId: team.id,
        name: team.name,
        icon: team.icon,
        accentIndex: team.accentIndex,
        total: team.score,
        members,
        rank: 0,
      };
    });

    rows.sort((a, b) => b.total - a.total);
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });
    return rows;
  }

  /**
   * Deletes a room and releases every per-room store it owned
   * (round state, content bags, AI rate-limit counters).
   */
  public deleteRoom(code: string): boolean {
    const room = this.getRoom(code);
    if (!room) return false;
    this.clearPhaseTimer(room);
    releaseRoomContent(room.code);
    // A deleted room must not keep its hidden round state (Top 100 holds the
    // secret list, the guesses and the team suggestions) alive on the server.
    cleanupTop100Round(room.code);
    this.rooms.delete(room.code);
    return true;
  }

  /**
   * Idle-room sweep: drops rooms that have had no connected player for
   * `maxIdleMs`, which is the engine's only room-cleanup point today.
   */
  public sweepIdleRooms(maxIdleMs: number = ROOM_IDLE_TIMEOUT_MS): string[] {
    const now = Date.now();
    const removed: string[] = [];
    for (const room of Array.from(this.rooms.values())) {
      const hasConnectedPlayer = room.players.some((player) => player.connected);
      if (hasConnectedPlayer) continue;
      if (now - room.lastActivityAt < maxIdleMs) continue;
      if (this.deleteRoom(room.code)) removed.push(room.code);
    }
    return removed;
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
        room.avoidState = null;
        room.mafiaState = null;
        room.gtlState = null;
        room.top100State = null;
        room.revCatState = null;
        room.gtlCustomPrompt = null;
        cleanupAvoidTheWordRound(room.code);
        cleanupMafiaRound(room.code);
        cleanupGtlRound(room.code);
        cleanupTop100Round(room.code);
        cleanupRevCatRound(room.code);
        cleanupImpostorQuestionRound(room.code);
        room.impostorQuestionState = null;
        releaseRoomContent(room.code);
        break;
      }

      case 'game-select': {
        room.phasePrompt = 'Choose a Game';
        room.phaseSubprompt = 'Host picks the game collection for this round';
        break;
      }

      case 'reveal': {
        // Impostor takes its word from the content engine. The shipped bag
        // answers immediately, but the provider is asynchronous, so the reveal
        // finishes in its own method rather than blocking the state machine.
        if (room.selectedGame?.id === IMPOSTOR_GAME_ID) {
          void this.startImpostorReveal(room, broadcastState);
          return;
        }

        // Avoid the Word draws its question the same way: async provider, so the
        // reveal (anchor + hidden question) finishes in its own method.
        if (room.selectedGame?.id === AVOID_THE_WORD_GAME_ID) {
          void this.startAvoidReveal(room, broadcastState);
          return;
        }

        // Top 100 draws a hidden ranked list through the content engine. The
        // list itself never leaves the server, so the reveal just publishes the
        // question and arms the guess phase.
        if (room.selectedGame?.id === TOP_100_GAME_ID) {
          void this.startTop100Reveal(room, broadcastState);
          return;
        }

        // Prepare private roles/words based on selected game
        if (room.selectedGame?.id === MAFIA_GAME_ID) {
          setupMafiaRound(room);
        } else if (room.selectedGame?.id === GUESS_THE_LINK_GAME_ID) {
          setupGtlRound(room);
        } else if (room.selectedGame?.id === REVERSE_CATEGORIES_GAME_ID) {
          setupReverseCategoriesRound(room);
        } else {
          this.setupPhaseReveal(room);
        }
        this.startRevealTimer(room, broadcastState);
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

      case 'avoid-anchor': {
        // The anchor privately receives the round's question and answers it. The
        // anchor can never be eliminated in their own round.
        if (room.selectedGame?.id !== AVOID_THE_WORD_GAME_ID) {
          this.transitionToPhase(room, 'input', broadcastState);
          return;
        }
        this.runAvoidAnchorPhase(room, broadcastState);
        break;
      }

      case 'avoid-turn': {
        // One alive player answers at a time; the phase repeats until every turn
        // this round has been played, then the round reveal opens.
        if (room.selectedGame?.id !== AVOID_THE_WORD_GAME_ID) {
          this.transitionToPhase(room, 'input', broadcastState);
          return;
        }
        this.runAvoidTurn(room, broadcastState);
        return; // runAvoidTurn performs its own broadcast
      }

      case 'avoid-reveal': {
        if (room.selectedGame?.id !== AVOID_THE_WORD_GAME_ID) break;
        beginAvoidReveal(room);
        room.phasePrompt = 'Round Reveal';
        room.phaseSubprompt = 'The host can overrule a close call, then Continue';
        break;
      }

      case 'input': {
        const inputIsGtl = room.selectedGame?.id === GUESS_THE_LINK_GAME_ID;
        const inputIsTop100 = room.selectedGame?.id === TOP_100_GAME_ID;
        const inputIsRevCat = room.selectedGame?.id === REVERSE_CATEGORIES_GAME_ID;
        const inputIsImpostorQuestion = this.isImpostorQuestionMode(room);
        room.phasePrompt = inputIsImpostorQuestion
          ? 'Answer Your Question'
          : inputIsRevCat
          ? 'Invent Your Category'
          : inputIsTop100
          ? 'Name Something on the List'
          : inputIsGtl
          ? 'Write Your Response'
          : 'Submit Your Clue';
        room.phaseSubprompt = inputIsImpostorQuestion
          ? 'Keep your answer short — the table will compare all of them'
          : inputIsRevCat
          ? 'One category name that cleverly links all three items'
          : inputIsTop100
          ? 'One guess each — the deeper it ranks, the more it scores'
          : inputIsGtl
          ? 'One word or a short phrase inspired by your private hint'
          : 'Enter a one-word clue before the timer expires';
        room.hasSubmittedInput.clear();

        // Auto-populate bot answers if any bots are in room
        if (room.selectedGame?.id === IMPOSTOR_GAME_ID) {
          if (inputIsImpostorQuestion) simulateImpostorQuestionBots(room);
          else simulateImpostorBotClues(room);
        } else if (inputIsGtl) {
          simulateGtlBotResponses(room);
        } else if (inputIsTop100) {
          // Bots lock a beat later, so the submitted board fills up live.
          this.scheduleTop100Bots(room, broadcastState);
        } else if (inputIsRevCat) {
          simulateRevCatBotCategories(room);
        } else {
          this.simulateBotInputs(room);
        }

        const top100GuessSeconds = inputIsTop100
          ? effectiveTop100GuessSeconds(readTop100Settings(room), room.playMode)
          : 0;

        const inputSeconds = inputIsImpostorQuestion
          ? QUESTION_INPUT_SECONDS
          : inputIsTop100
          ? top100GuessSeconds
          : inputIsRevCat
          ? RC_INPUT_SECONDS
          : inputIsGtl
          ? GTL_INPUT_SECONDS
          : 20;

        this.startPhaseTimer(
          room,
          inputSeconds,
          () => broadcastState(),
          () => {
            if (room.selectedGame?.id === IMPOSTOR_GAME_ID) {
              this.finalizeImpostorInput(room);
            } else if (room.selectedGame?.id === GUESS_THE_LINK_GAME_ID) {
              finalizeGtlReveal(room);
            } else if (room.selectedGame?.id === TOP_100_GAME_ID) {
              finalizeTop100Guesses(room);
            } else if (room.selectedGame?.id === REVERSE_CATEGORIES_GAME_ID) {
              finalizeRevCatReveal(room);
            }
            this.transitionToPhase(room, 'reveal-answers', broadcastState);
          }
        );
        break;
      }

      case 'reveal-answers': {
        const revealIsGtl = room.selectedGame?.id === GUESS_THE_LINK_GAME_ID;
        const revealIsTop100 = room.selectedGame?.id === TOP_100_GAME_ID;
        const revealIsRevCat = room.selectedGame?.id === REVERSE_CATEGORIES_GAME_ID;
        const revealIsImpostorQuestion = this.isImpostorQuestionMode(room);
        room.phasePrompt = revealIsImpostorQuestion
          ? 'The Answer Board'
          : revealIsRevCat
          ? 'The Category Board'
          : revealIsGtl
          ? 'The Link Board'
          : revealIsTop100
          ? 'The Guesses Board'
          : 'Simultaneous Reveal';
        room.phaseSubprompt = revealIsImpostorQuestion
          ? 'Every answer, shuffled — did one of them fit a different question?'
          : revealIsRevCat
          ? 'Every invented category, shuffled — then vote for the best one'
          : revealIsGtl
          ? 'Every response, shuffled — what single concept ties them together?'
          : revealIsTop100
          ? 'Every guess with its position — the host can overrule a close call'
          : 'Review every player’s clue in randomized order';
        if (room.selectedGame?.id === 'impostor') {
          this.finalizeImpostorInput(room);
        } else if (revealIsGtl) {
          finalizeGtlReveal(room);
        } else if (revealIsTop100) {
          finalizeTop100Guesses(room);
        } else if (revealIsRevCat) {
          finalizeRevCatReveal(room);
        } else {
          this.prepareRevealedAnswers(room);
        }

        const revealSeconds = revealIsTop100
          ? TOP100_OVERRULE_SECONDS
          : revealIsRevCat
          ? RC_REVEAL_SECONDS
          : revealIsGtl
          ? GTL_REVEAL_SECONDS
          : 15;

        this.startPhaseTimer(
          room,
          revealSeconds,
          () => broadcastState(),
          () =>
            this.transitionToPhase(
              room,
              revealIsGtl
                ? 'guess'
                : revealIsTop100
                ? 'results'
                : revealIsRevCat
                ? 'vote'
                : 'discussion',
              broadcastState
            )
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
        if (this.isImpostorQuestionMode(room)) {
          room.phasePrompt = 'Compare Answers';
          room.phaseSubprompt = 'Whose answer feels like it belongs to a different question?';
        } else {
          room.phasePrompt = 'Group Discussion';
          room.phaseSubprompt = 'Compare clues, spot the bluffer, or skip early to vote!';
        }
        // Warm the next round's content (and any AI batch) while the table talks.
        if (room.selectedGame?.id === IMPOSTOR_GAME_ID) {
          if (this.isImpostorQuestionMode(room)) {
            prefetchQuestionContent(room.code, { tone: room.gameSettings.impostor.tone });
          } else {
            prefetchWordContent(room.code, {
              difficulty: room.gameSettings.impostor.difficulty,
              theme: room.gameSettings.impostor.theme,
            });
          }
        }
        this.startPhaseTimer(
          room,
          90,
          () => broadcastState(),
          () => this.transitionToPhase(room, 'vote', broadcastState)
        );
        break;
      }

      case 'vote': {
        const voteIsRevCat = room.selectedGame?.id === REVERSE_CATEGORIES_GAME_ID;
        room.phasePrompt = voteIsRevCat ? 'Vote Best Category' : 'Cast Your Accusation';
        room.phaseSubprompt = voteIsRevCat
          ? 'Pick the invented category that links the items best'
          : 'Tap a suspect to vote them out';
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
          this.calculateImpostorRoundResults(room);
        } else if (room.selectedGame?.id === AVOID_THE_WORD_GAME_ID) {
          calculateAvoidResults(room);
        } else if (room.selectedGame?.id === MAFIA_GAME_ID) {
          calculateMafiaResults(room);
        } else if (room.selectedGame?.id === GUESS_THE_LINK_GAME_ID) {
          calculateGtlResults(room);
        } else if (room.selectedGame?.id === TOP_100_GAME_ID) {
          // Points land here (host overrules included) and the round's results
          // carry the 1-10 / 90-100 slices. The last round reports the final
          // standings instead of a "next round" prompt.
          const { gameOver } = applyTop100Scores(room);
          buildTop100Results(room, { final: gameOver });
        } else if (room.selectedGame?.id === REVERSE_CATEGORIES_GAME_ID) {
          calculateReverseCategoriesResults(room);
        } else {
          this.calculateResults(room);
        }
        // Team mode: the round resolves into a team leaderboard built from the
        // individual standings, in one central place for every game.
        if (room.results) {
          room.results.teamStandings =
            room.playMode === 'team'
              ? this.buildTeamStandings(room, room.results.standings)
              : undefined;
        }
        if (room.selectedGame?.id === TOP_100_GAME_ID) {
          room.phasePrompt = 'How the List Looks';
          room.phaseSubprompt = 'The revealed slices, your own guess, then the standings';
        } else {
          room.phasePrompt = 'Round Results';
          room.phaseSubprompt = 'Points awarded and secrets unmasked!';
        }
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
   * Impostor reveal: serves the round's word from the content engine (so a word
   * never repeats inside a room) and then runs the standard reveal timer.
   */
  private async startImpostorReveal(room: InternalRoom, broadcastState: () => void) {
    const settings = room.gameSettings.impostor;

    if (settings.mode === 'question') {
      // Question mode: every player privately receives a question. The impostor
      // gets a related but different one, and nothing on screen says so.
      const pair = await questionProvider.next(room.code, { tone: settings.tone });

      // A host skip or disconnect may have moved the room on while we waited.
      if (room.phase !== 'reveal' || room.selectedGame?.id !== IMPOSTOR_GAME_ID) return;

      setupImpostorQuestionRound(room, pair);
      this.startRevealTimer(room, broadcastState, {
        prompt: 'Your Question',
        subprompt: 'Answer privately — nobody sees it until the reveal',
      });
      broadcastState();
      return;
    }

    const word = await wordProvider.next(room.code, {
      difficulty: settings.difficulty,
      theme: settings.theme,
    });

    // A host skip or disconnect may have moved the room on while we waited.
    if (room.phase !== 'reveal' || room.selectedGame?.id !== IMPOSTOR_GAME_ID) return;

    // Word mode owns no question state: clear anything a question round left.
    room.impostorQuestionState = null;
    setupImpostorRound(room, word);
    this.startRevealTimer(room, broadcastState);
    broadcastState();
  }

  /** True while the selected Impostor round is question mode. */
  private isImpostorQuestionMode(room: InternalRoom): boolean {
    return (
      room.selectedGame?.id === IMPOSTOR_GAME_ID && room.gameSettings.impostor.mode === 'question'
    );
  }

  /** Compiles the Impostor answers board for whichever mode is running. */
  private finalizeImpostorInput(room: InternalRoom) {
    if (this.isImpostorQuestionMode(room)) finalizeImpostorQuestionReveal(room);
    else finalizeImpostorReveal(room);
  }

  /** Impostor results for whichever mode is running. */
  private calculateImpostorRoundResults(room: InternalRoom) {
    if (this.isImpostorQuestionMode(room)) calculateImpostorQuestionResults(room);
    else calculateImpostorResults(room);
  }

  /**
   * Shared reveal copy + timer, used by every game's reveal phase.
   */
  private startRevealTimer(
    room: InternalRoom,
    broadcastState: () => void,
    copy?: { prompt: string; subprompt: string }
  ) {
    // Reverse Categories hides nothing, so it never uses the secret-role copy.
    const revealIsRevCat = room.selectedGame?.id === REVERSE_CATEGORIES_GAME_ID;
    room.phasePrompt = copy?.prompt ?? (revealIsRevCat ? 'Your Three Items' : 'Check Your Secret Role');
    room.phaseSubprompt =
      copy?.subprompt ??
      (revealIsRevCat
        ? 'Everyone sees the same items — invent the best category that links them'
        : 'Keep your screen hidden from others!');
    this.startPhaseTimer(
      room,
      10,
      () => broadcastState(),
      () => this.transitionToPhase(room, this.phaseAfterReveal(room), broadcastState)
    );
  }

  /**
   * Top 100 reveal: draws a hidden ranked list from the content engine. The list
   * never leaves this method — only the question, its category and the round
   * counter are published, and the guess phase opens right after the beat.
   */
  private async startTop100Reveal(room: InternalRoom, broadcastState: () => void) {
    const settings = readTop100Settings(room);
    const previous = getTop100Round(room.code);
    // A finished game is not continued: the round counter restarts at one.
    if (!previous || previous.gameOver) room.roundNumber = 1;

    const list = await top100Provider.next(room.code, {
      region: settings.region,
      categories: settings.categories,
    });

    // A host skip or a disconnect may have moved the room on while we waited.
    if (room.phase !== 'reveal' || room.selectedGame?.id !== TOP_100_GAME_ID) return;

    const state = setupTop100Round(room, list);
    room.phasePrompt = `Round ${state.roundNumber} of ${state.roundCount}`;
    room.phaseSubprompt = 'Name something that is on this Top 100 — the deeper it ranks, the more it scores';

    this.startPhaseTimer(
      room,
      TOP100_QUESTION_SECONDS,
      () => broadcastState(),
      () => this.transitionToPhase(room, 'input', broadcastState)
    );
    broadcastState();
  }

  /**
   * Top 100: bots act a beat after the guess phase opens — teammates suggest, and
   * every bot that owes a guess (solo players and team captains) locks one — so
   * the submitted board fills up live instead of resolving instantly.
   */
  private scheduleTop100Bots(room: InternalRoom, broadcastState: () => void) {
    if (room.playMode === 'team') {
      this.scheduleBotAction(room, 900 + Math.floor(Math.random() * 1200), () => {
        if (room.phase !== 'input') return;
        if (room.selectedGame?.id !== TOP_100_GAME_ID) return;
        simulateTop100BotSuggestions(room);
        broadcastState();
      });
    }

    this.scheduleBotAction(room, 1800 + Math.floor(Math.random() * 2500), () => {
      if (room.phase !== 'input') return;
      if (room.selectedGame?.id !== TOP_100_GAME_ID) return;
      if (simulateTop100BotGuesses(room).length === 0) return;

      if (pendingTop100Guessers(room).length === 0) {
        finalizeTop100Guesses(room);
        this.transitionToPhase(room, 'reveal-answers', broadcastState);
        return;
      }
      broadcastState();
    });
  }

  /**
   * Games with a dedicated engine leave the reveal phase into their own phase.
   */
  private phaseAfterReveal(room: InternalRoom): GamePhase {
    if (room.selectedGame?.id === AVOID_THE_WORD_GAME_ID) return 'avoid-anchor';
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
   * Avoid the Word: draws the round's question and opens the reveal phase.
   * The question is served by the content engine (no repeats inside a room) and
   * is only ever written into the anchor's private state.
   */
  private async startAvoidReveal(room: InternalRoom, broadcastState: () => void) {
    const settings = readAvoidSettings(room);
    const storedState = getAvoidRound(room.code);
    // A finished game is not continued: "play another game" brings everybody back
    // in and the round counter restarts at one.
    const previous = storedState && !storedState.gameOver ? storedState : undefined;
    if (!previous) room.roundNumber = 1;

    // Players who left the room drop out of the alive set; if that leaves fewer
    // than two, the game is decided rather than restarted.
    const aliveIds = previous
      ? [...previous.alive].filter((id) => room.players.some((player) => player.id === id))
      : room.players.map((player) => player.id);

    if (aliveIds.length < 2) {
      if (previous) {
        previous.alive = new Set(aliveIds);
        previous.winnerPlayerIds = aliveIds;
        previous.gameOver = true;
      }
      this.transitionToPhase(room, 'results', broadcastState);
      return;
    }

    const question = await avoidQuestionProvider.next(room.code, {
      tone: settings.tone,
      aliveCount: aliveIds.length,
    });

    // A host skip or a disconnect may have moved the room on while we waited.
    if (room.phase !== 'reveal' || room.selectedGame?.id !== AVOID_THE_WORD_GAME_ID) return;

    const info = setupAvoidRound(room, question, {
      alive: aliveIds,
      ...(previous ? { previousState: previous } : {}),
    });

    this.startRevealTimer(room, broadcastState, {
      prompt: `Round ${info.roundNumber}: ${info.anchorName} is the Anchor`,
      subprompt:
        'Only the anchor sees the question — everyone else answers it on their turn',
    });
    broadcastState();
  }

  /**
   * Avoid the Word: opens the anchor's private answer window and arms its timer.
   */
  private runAvoidAnchorPhase(room: InternalRoom, broadcastState: () => void) {
    const settings = readAvoidSettings(room);
    const info = beginAvoidAnchorPhase(room);

    if (!info) {
      this.transitionToPhase(room, 'avoid-turn', broadcastState);
      return;
    }

    room.phasePrompt = `${info.anchorName} is Answering`;
    room.phaseSubprompt =
      'The anchor picks what the group is most likely to say — the answer stays hidden';

    this.startPhaseTimer(
      room,
      settings.anchorSeconds,
      () => broadcastState(),
      () => this.resolveAvoidTimeout(room, broadcastState)
    );

    if (this.isAvoidBot(room, info.anchorId)) {
      this.scheduleAvoidBotAnswer(room, info.anchorId, broadcastState);
    }

    broadcastState();
  }

  /**
   * Avoid the Word: one alive player answers at a time. The phase re-enters
   * itself until every turn this round has been played.
   */
  private runAvoidTurn(room: InternalRoom, broadcastState: () => void) {
    const state = getAvoidRound(room.code);
    if (!state) {
      this.transitionToPhase(room, 'avoid-reveal', broadcastState);
      return;
    }
    if (state.gameOver) {
      this.transitionToPhase(room, 'results', broadcastState);
      return;
    }

    const activeId = nextAvoidTurnPlayerId(state);
    if (!activeId) {
      this.transitionToPhase(room, 'avoid-reveal', broadcastState);
      return;
    }

    const settings = readAvoidSettings(room);
    const info = beginAvoidTurn(room, activeId);

    room.phasePrompt = `${info.playerName}'s Turn`;
    room.phaseSubprompt = `Turn ${info.turnNumber} of ${info.totalTurns} — everyone else waits`;

    this.startPhaseTimer(
      room,
      settings.turnSeconds,
      () => broadcastState(),
      () => this.resolveAvoidTimeout(room, broadcastState)
    );

    if (this.isAvoidBot(room, activeId)) {
      this.scheduleAvoidBotAnswer(room, activeId, broadcastState);
    }

    broadcastState();
  }

  /** True when the player is a simulated bot (bots answer from bundled content). */
  private isAvoidBot(room: InternalRoom, playerId: string): boolean {
    return Boolean(room.players.find((player) => player.id === playerId)?.isBot);
  }

  /**
   * Simulated bot answers: a plausible answer a beat after the window opens. Bots
   * never call the AI and never see the anchor's answer.
   */
  private scheduleAvoidBotAnswer(
    room: InternalRoom,
    playerId: string,
    broadcastState: () => void
  ) {
    const phase = room.phase;
    const state = getAvoidRound(room.code);
    if (!state) return;

    this.scheduleBotAction(room, 1400 + Math.floor(Math.random() * 1600), () => {
      if (room.phase !== phase) return;
      const live = getAvoidRound(room.code);
      if (!live) return;
      const activeId =
        phase === 'avoid-anchor' ? live.anchorId : nextAvoidTurnPlayerId(live);
      if (activeId !== playerId) return;
      this.submitAvoidAnswer(room, playerId, pickAvoidBotAnswer(room, live), broadcastState);
    });
  }

  /**
   * Avoid the Word: the open answer window ran out (or the player dropped). The
   * turn is recorded as a skip, which counts as safe, and two skips in a row
   * eliminate the player as AFK.
   */
  private resolveAvoidTimeout(room: InternalRoom, broadcastState: () => void) {
    const phase = room.phase;
    if (phase !== 'avoid-anchor' && phase !== 'avoid-turn') return;
    const state = getAvoidRound(room.code);
    if (!state) return;

    const activeId = phase === 'avoid-anchor' ? state.anchorId : nextAvoidTurnPlayerId(state);
    if (!activeId) return;

    recordAvoidSkip(room, activeId, phase);

    if (phase === 'avoid-anchor') {
      this.transitionToPhase(room, 'avoid-turn', broadcastState);
      return;
    }

    advanceAvoidTurn(state);
    this.advanceAvoid(room, broadcastState);
  }

  /**
   * Avoid the Word: moves on to the next turn, the round reveal, or the end of
   * the game, whichever comes first.
   */
  private advanceAvoid(room: InternalRoom, broadcastState: () => void) {
    const state = getAvoidRound(room.code);
    if (!state) {
      this.transitionToPhase(room, 'avoid-reveal', broadcastState);
      return;
    }
    if (state.gameOver) {
      this.transitionToPhase(room, 'results', broadcastState);
      return;
    }
    if (hasMoreAvoidTurns(state)) {
      this.transitionToPhase(room, 'avoid-turn', broadcastState);
      return;
    }
    this.transitionToPhase(room, 'avoid-reveal', broadcastState);
  }

  /**
   * Sets up private data per player for the reveal phase
   */
  private setupPhaseReveal(room: InternalRoom) {
    const gameId = room.selectedGame?.id || 'impostor';
    room.privateData = {};

    // Pick 1 player randomly to be Impostor/Special Role
    const impostorIndex = Math.floor(Math.random() * room.players.length);
    const wordItem = randomCorpusWord('any');
    const secretWord = wordItem.word;
    const secretCategory = `${wordItem.category} (tier ${wordItem.difficulty})`;

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
      if (this.isImpostorQuestionMode(room)) {
        const outcome = recordImpostorQuestionAnswer(room, playerId, answer);
        if (!outcome.accepted) return;
      } else {
        recordPlayerClue(room, playerId, answer);
      }
    } else if (room.selectedGame?.id === GUESS_THE_LINK_GAME_ID) {
      recordGtlResponse(room, playerId, answer);
    } else if (room.selectedGame?.id === TOP_100_GAME_ID) {
      const outcome = recordTop100Guess(room, playerId, answer);
      if (!outcome.accepted) {
        broadcastState();
        return;
      }
      // Top 100 decides for itself when the round has every guess it needs:
      // solo counts players, team mode counts teams (one captain each).
      if (pendingTop100Guessers(room).length === 0) {
        finalizeTop100Guesses(room);
        this.transitionToPhase(room, 'reveal-answers', broadcastState);
        return;
      }
      broadcastState();
      return;
    } else if (room.selectedGame?.id === REVERSE_CATEGORIES_GAME_ID) {
      recordRevCatCategory(room, playerId, answer);
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
        this.finalizeImpostorInput(room);
      } else if (room.selectedGame?.id === GUESS_THE_LINK_GAME_ID) {
        finalizeGtlReveal(room);
      } else if (room.selectedGame?.id === REVERSE_CATEGORIES_GAME_ID) {
        finalizeRevCatReveal(room);
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
   * Avoid the Word: the player whose input is open submits their answer.
   * Matching the anchor's hidden answer is decided here, immediately, so the room
   * gets a live announcement (never the answer itself).
   */
  public submitAvoidAnswer(
    room: InternalRoom,
    playerId: string,
    input: { raw: string; playerId?: string },
    broadcastState: () => void
  ) {
    if (room.selectedGame?.id !== AVOID_THE_WORD_GAME_ID) return;
    const phase = room.phase;
    if (phase !== 'avoid-anchor' && phase !== 'avoid-turn') return;

    const outcome = recordAvoidAnswer(room, playerId, input, phase);
    if (!outcome.accepted) {
      broadcastState();
      return;
    }

    this.clearBotTimeouts(room);

    if (phase === 'avoid-anchor') {
      this.transitionToPhase(room, 'avoid-turn', broadcastState);
      return;
    }

    const state = getAvoidRound(room.code);
    if (state) advanceAvoidTurn(state);
    this.advanceAvoid(room, broadcastState);
  }

  /**
   * Avoid the Word: the host overrules a close call (synonyms, typos) during the
   * round reveal. countAsMatch=true eliminates the player, false keeps them safe.
   */
  public hostOverruleAvoidMatch(
    room: InternalRoom,
    playerId: string,
    targetPlayerId: string,
    countAsMatch: boolean,
    broadcastState: () => void
  ) {
    if (room.selectedGame?.id !== AVOID_THE_WORD_GAME_ID) return;
    if (room.phase !== 'avoid-reveal') return;
    if (playerId !== room.hostId) return;

    const result = setAvoidOverrule(room, targetPlayerId, countAsMatch);
    if (!result.success) return;
    broadcastState();
  }

  /**
   * Avoid the Word: the host applies the round's eliminations. When the game is
   * decided it moves to results, otherwise it deals the next round.
   */
  public hostContinueAvoidReveal(
    room: InternalRoom,
    playerId: string,
    broadcastState: () => void
  ) {
    if (room.selectedGame?.id !== AVOID_THE_WORD_GAME_ID) return;
    if (room.phase !== 'avoid-reveal') return;
    if (playerId !== room.hostId) return;

    const settings = readAvoidSettings(room);
    const { gameOver } = applyAvoidEliminations(room, settings);

    if (gameOver) {
      this.transitionToPhase(room, 'results', broadcastState);
      return;
    }

    room.roundNumber += 1;
    this.transitionToPhase(room, 'reveal', broadcastState);
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
   * Top 100 (team mode): a teammate sends a short suggestion that only their own
   * team sees. The caller is responsible for pushing it to that team's sockets
   * (see `emitToTeam` in server/index.ts) — it never enters public room state.
   */
  public submitTop100Suggestion(
    room: InternalRoom,
    playerId: string,
    text: string,
    broadcastState: () => void
  ): { success: boolean; error?: string; teamId?: string } {
    if (room.phase !== 'input') return { success: false, error: 'Suggestions are closed.' };
    if (room.selectedGame?.id !== TOP_100_GAME_ID) return { success: false, error: 'Wrong game.' };

    const player = room.players.find((candidate) => candidate.id === playerId);
    const teamId = player?.teamId;
    const outcome = addTop100Suggestion(room, playerId, text);
    // Team-private: the round state changed for the team, so every member's
    // private state is refreshed (and the room's public state is untouched).
    broadcastState();
    if (!outcome.accepted) return { success: false, error: outcome.error, ...(teamId ? { teamId } : {}) };
    return { success: true, ...(teamId ? { teamId } : {}) };
  }

  /** The team's suggestions as the server sees them (team-scoped emit helper). */
  public top100SuggestionsForTeam(roomCode: string, teamId: string) {
    return teamSuggestions(roomCode, teamId);
  }

  /**
   * Top 100: the host overrules a guess on the guesses board — a forced list
   * position, or null for "not on the list". Host-only, before points are final.
   */
  public hostOverruleTop100Guess(
    room: InternalRoom,
    playerId: string,
    rowId: string,
    rank: number | null,
    broadcastState: () => void
  ) {
    if (room.phase !== 'reveal-answers') return;
    if (room.selectedGame?.id !== TOP_100_GAME_ID) return;
    if (playerId !== room.hostId) return;

    const result = setTop100Overrule(room, String(rowId), rank === null ? null : Number(rank));
    if (!result.success) return;
    broadcastState();
  }

  /**
   * Top 100: the host taps Continue on the guesses board. Points become final
   * (overrules included) and the round resolves into the slices screen.
   */
  public hostContinueTop100Reveal(
    room: InternalRoom,
    playerId: string,
    broadcastState: () => void
  ) {
    if (room.phase !== 'reveal-answers') return;
    if (room.selectedGame?.id !== TOP_100_GAME_ID) return;
    if (playerId !== room.hostId) return;

    this.clearBotTimeouts(room);
    finalizeTop100Guesses(room);
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

      awardPoints(room, player.id, points, 'impostor:round');

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
    // Keep derived team membership (and every team total) in step before exposing.
    this.syncTeamMembership(room);
    this.seatUnassignedPlayers(room);
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
        ...(p.teamId ? { teamId: p.teamId } : {}),
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
      avoidState: room.avoidState,
      mafiaState: room.mafiaState,
      gtlState: room.gtlState,
      top100State: room.top100State,
      revCatState: room.revCatState,
      impostorQuestionState: room.impostorQuestionState,
      gameSettings: room.gameSettings,
      playMode: room.playMode,
      teams: room.teams,
      aiContentAvailable: isAiAvailable(),
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
    // Avoid the Word keeps the round's question scoped to the player whose input
    // is open, so a reconnect mid-turn gets the question (and the remaining time
    // from the public timer) back.
    if (room.selectedGame?.id === AVOID_THE_WORD_GAME_ID) {
      syncAvoidPrivateState(room, room.phase);
    }
    // Top 100: the captain's input, the team's suggestions and the player's own
    // round result all live here, so a reconnect gets them back.
    if (room.selectedGame?.id === TOP_100_GAME_ID) {
      syncTop100PrivateState(room);
    }
    return room.privateData[playerId] || {};
  }
}

export const roomManager = new RoomManager();
