/**
 * Global TypeScript types for the Party Games engine.
 */

export interface Player {
  id: string;
  name: string;
  colorIndex: number; // 0 to 5
  colorHex: string;
  colorName: string;
  isHost: boolean;
  connected: boolean;
  score: number;
  sessionToken: string;
  joinedAt: number;
  /** Team-mode only: the team this player plays for. Keyed by sessionToken,
   *  so reconnecting restores it. */
  teamId?: string;
}

export type GamePhase =
  | 'lobby'
  | 'game-select'
  | 'reveal'
  | 'input'
  | 'avoid-anchor'
  | 'avoid-turn'
  | 'avoid-reveal'
  | 'night'
  | 'day'
  | 'reveal-answers'
  | 'guess'
  | 'rank'
  | 'discussion'
  | 'vote'
  | 'results'
  | 'next-round'
  | 'post-game';

export interface GameMetadata {
  id: string;
  title: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  icon: 'mask' | 'ban' | 'detective' | 'link' | 'list-ordered' | 'shuffle';
  description: string;
  rules: string[];
  /**
   * How the game behaves in room team mode. `aggregate` plays exactly as it
   * does in solo and its points roll up to teams; `native` has team-specific
   * rules planned, so until they ship it is treated as `aggregate`.
   */
  teamSupport: 'aggregate' | 'native';
}

export interface PhaseTimer {
  durationSeconds: number;
  endsAtTimestamp: number;
  remainingSeconds: number;
}

export type PlayMode = 'solo' | 'team';

/**
 * A room-level team. Team totals are derived from individual scores and are
 * maintained centrally by awardPoints(), never by a game module.
 */
export interface Team {
  id: string;
  name: string;
  /** Emoji shown next to the team name (team identity is never colour-only). */
  icon: string;
  /** Index into TEAM_ACCENTS in shared/theme/tokens.ts. */
  accentIndex: number;
  score: number;
  memberIds: string[];
}

/** One team member's contribution inside a round's team leaderboard. */
export interface TeamStandingMember {
  playerId: string;
  playerName: string;
  colorIndex: number;
  pointsAdded: number;
  totalScore: number;
}

/** Public team leaderboard entry, built server-side when a round resolves. */
export interface TeamStanding {
  teamId: string;
  name: string;
  icon: string;
  accentIndex: number;
  total: number;
  members: TeamStandingMember[];
  rank: number;
}

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 4;

/** Host-round settings, editable from the lobby settings sheet. */
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 7;

export type ImpostorMode = 'word' | 'question';
export type ContentDifficultySetting = 'easy' | 'medium' | 'any';
export type QuestionTone = 'clean' | 'spicy';

/**
 * Host-authored, fully public settings for the Impostor game. They describe how
 * a round is played, never what the round's secret content is, so they can live
 * in the broadcast room state.
 */
export interface ImpostorSettings {
  mode: ImpostorMode;
  difficulty: ContentDifficultySetting;
  tone: QuestionTone;
  /** Optional host topic for word mode. Omitted when unset. */
  theme?: string;
}

export type AnswerType = 'player' | 'text' | 'number' | 'choice';

export type QuestionKind =
  | 'most-likely'
  | 'about-player'
  | 'preference'
  | 'hypothetical'
  | 'numeric'
  | 'choice';

/**
 * One Impostor question pair: the crew's question (Q) and the impostor's
 * different-but-related question (Q'). Both sides always share the same answer
 * type, choices and numeric range so the answers stay plausible side by side.
 */
export interface QuestionPair {
  id: string;
  kind: QuestionKind;
  answerType: AnswerType;
  tone: QuestionTone;
  /** `text` may contain `{target}`; `selfText` is what the target themself sees. */
  crew: { text: string; selfText?: string };
  impostor: { text: string };
  needsTarget: boolean;
  /** Shared by both sides (choice questions only). */
  choices?: string[];
  /** Shared by both sides (numeric questions only). */
  numberRange?: { min: number; max: number };
}

/** Public question-mode round state. Never carries a question before results. */
export interface ImpostorQuestionState {
  answerType: AnswerType;
  /** Players who have answered this round (public, like hasSubmittedInput). */
  answeredPlayerIds: string[];
  totalPlayers: number;
  /** Distinct question pairs this room has already played. */
  roundsPlayed: number;
  /** Choice options when the round is a choice question (public once answering). */
  choices?: string[];
  numberRange?: { min: number; max: number };
  /** True while the answers board is up. */
  answersReady: boolean;
}

/** Room-wide per-game settings (only Impostor uses them today). */
export interface GameSettings {
  impostor: ImpostorSettings;
  avoidTheWord: AvoidSettings;
}

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  solo: 'Solo',
  team: 'Team',
};

export const DEFAULT_IMPOSTOR_SETTINGS: ImpostorSettings = {
  mode: 'word',
  difficulty: 'easy',
  tone: 'clean',
};

export const IMPOSTOR_MODE_LABELS: Record<ImpostorMode, string> = {
  word: 'Word',
  question: 'Question',
};

export const DIFFICULTY_LABELS: Record<ContentDifficultySetting, string> = {
  easy: 'Easy',
  medium: 'Medium',
  any: 'Any',
};

export const TONE_LABELS: Record<QuestionTone, string> = {
  clean: 'Clean',
  spicy: 'Spicy',
};

export interface RevealedAnswer {
  playerId: string;
  playerName: string;
  playerColor: string;
  colorIndex: number;
  answerText: string;
  revealed: boolean;
  subtext?: string;
  /**
   * Impostor question mode only: when the answer names another player
   * ('player' answer type), the client renders that player's chip.
   */
  answeredPlayerId?: string;
}

export interface PlayerResultStanding {
  playerId: string;
  playerName: string;
  playerColor: string;
  colorIndex: number;
  pointsAdded: number;
  totalScore: number;
  badge?: string;
}

export interface RoleRevealInfo {
  playerId: string;
  playerName: string;
  playerColor: string;
  colorIndex: number;
  role: string;
  isSpecialRole: boolean;
  explanation: string;
}

export interface VoteBreakdownItem {
  voterId: string;
  voterName: string;
  voterColorIndex: number;
  targetId: string;
  targetName: string;
  isCorrect: boolean;
}

/* ─────────────────────────── Avoid the Word ─────────────────────────────── */

export type AvoidAnswerType = 'text' | 'choice' | 'number' | 'player';

/**
 * One Avoid the Word question. Answer spaces must be comfortably bigger than the
 * table, otherwise everyone matches by accident: `minPlayers` plus the
 * answer-space rules enforced by the provider decide eligibility each round.
 */
export interface AvoidQuestion {
  id: string;
  text: string;
  answerType: AvoidAnswerType;
  category: string;
  tone: QuestionTone;
  /** Alive players needed before this question may be served. */
  minPlayers: number;
  /** 'choice' only: at least 8 options. */
  choices?: string[];
  /** 'number' only: the range must span at least 20 values. */
  numberRange?: { min: number; max: number };
  /** 'text' only: plausible answers used by simulated bots. */
  botAnswers?: string[];
}

/** Host settings for Avoid the Word (public state: strategy, never secrets). */
export interface AvoidSettings {
  anchorSeconds: number;
  turnSeconds: number;
  roundCap: number;
  tone: QuestionTone;
}

/**
 * Host-editable bounds for Avoid the Word, shared so the settings UI and the
 * server clamp identically. The answer-space minimums below are the contract the
 * question seed bank and the AI validator both have to satisfy.
 */
export const AVOID_SETTINGS_LIMITS = {
  anchorSeconds: { min: 10, max: 60 },
  turnSeconds: { min: 10, max: 60 },
  roundCap: { min: 3, max: 20 },
} as const;

/** Smallest choice answer space, shared by the data and the validator. */
export const AVOID_CHOICE_MIN_OPTIONS = 8;
/** Smallest numeric answer space. */
export const AVOID_NUMBER_MIN_RANGE = 20;
/** 'player' questions need this many alive players to be interesting. */
export const AVOID_PLAYER_MIN_ALIVE = 5;

export const DEFAULT_AVOID_SETTINGS: AvoidSettings = {
  anchorSeconds: 30,
  turnSeconds: 20,
  roundCap: 10,
  tone: 'clean',
};

/**
 * A player's state during the round.
 * waiting   — has not had their turn yet
 * safe      — answered and did not match the anchor
 * matched   — answered and matched the anchor (eliminated on Continue)
 * skipped   — timed out; counts as safe, but two in a row is an AFK elimination
 * eliminated— out of the game (spectator)
 */
export type AvoidTurnStatus = 'waiting' | 'safe' | 'matched' | 'skipped' | 'eliminated';

export const AVOID_STATUS_LABELS: Record<AvoidTurnStatus, string> = {
  waiting: 'Waiting',
  safe: 'Safe',
  matched: 'Matched',
  skipped: 'Skipped',
  eliminated: 'Out',
};

/** One row of the public status strip (never carries an answer before the reveal). */
export interface AvoidPlayerStatus {
  playerId: string;
  playerName: string;
  colorIndex: number;
  status: AvoidTurnStatus;
  /** Consecutive skipped turns; reaching 2 eliminates the player as AFK. */
  skippedStreak: number;
  /** Round the player was eliminated in (null while still alive). */
  eliminatedRound: number | null;
}

/** One player's answer inside the round reveal (public once revealed). */
export interface AvoidAnswerRow {
  playerId: string;
  playerName: string;
  colorIndex: number;
  answer: string;
  /** 'player' answers: who they named. */
  answeredPlayerId?: string;
  answeredPlayerName?: string;
  /** True when the answer matched the anchor (before any host overrule). */
  matched: boolean;
  overruled?: boolean;
  skipped: boolean;
  isAnchor: boolean;
  pointsAdded: number;
}

/** Players eliminated together in one round (they tie on placement). */
export interface AvoidEliminationRound {
  round: number;
  playerIds: string[];
}

/**
 * Public Avoid the Word state. It never carries the round's question or anybody's
 * answer before the round reveal — only who is answering, the status strip and the
 * live match announcements (which name the player, never the answer).
 */
export interface AvoidPublicState {
  roundNumber: number;
  roundCap: number;
  anchorPlayerId: string;
  anchorPlayerName: string;
  /** Whose input is open right now ('' when no turn is running). */
  activePlayerId: string;
  activePlayerName: string;
  statuses: AvoidPlayerStatus[];
  alivePlayerIds: string[];
  aliveCount: number;
  /** Alive non-anchor players, in this round's randomized turn order. */
  turnOrder: string[];
  turnNumber: number;
  totalTurns: number;
  matchedPlayerIds: string[];
  /** Most recent match this round — drives the live banner (never the answer). */
  lastMatchedPlayerId: string;
  /** Public because it shapes the input the table expects, not the question. */
  answerType: AvoidAnswerType;
  overrules: Record<string, boolean>;
  revealed: boolean;
  /** Round reveal only. */
  questionText?: string;
  anchorAnswer?: string;
  rows?: AvoidAnswerRow[];
  eliminations: AvoidEliminationRound[];
  /** True once the game has ended (the results phase shows the placements). */
  gameOver: boolean;
  winnerPlayerIds: string[];
  winnerTeamIds: string[];
  anchorSeconds: number;
  turnSeconds: number;
  eligiblePlayerCount: number;
}

/** One line of the final placement table (by elimination order, ties shared). */
export interface AvoidPlacement {
  playerId: string;
  playerName: string;
  colorIndex: number;
  placement: number;
  /** Round they were eliminated in; null when they survived to the end. */
  eliminatedRound: number | null;
  pointsAdded: number;
  totalScore: number;
  isWinner: boolean;
  teamName?: string;
  teamIcon?: string;
}

export interface GtlGuessResult {
  playerId: string;
  playerName: string;
  playerColor: string;
  colorIndex: number;
  hint: string;          // the angle this player was dealt
  guessText: string;     // what they thought the hidden concept was
  correct: boolean;
  pointsAdded: number;
}

export interface GtlHintShare {
  playerId: string;
  playerName: string;
  colorIndex: number;
  hint: string;
}

export interface Top100ExampleCard {
  playerId: string;
  playerName: string;
  playerColor: string;
  colorIndex: number;
  text: string;
  /** Only populated once the round is revealed (results). */
  secretNumber?: number;
}

export interface Top100OrderEntry extends Top100ExampleCard {
  secretNumber: number;
  hostPosition: number;  // 1-based slot in the host's final ordering
  truePosition: number;  // 1-based slot in true ascending numeric order
  correctlyPlaced: boolean;
}

export interface Top100PublicState {
  category: string;
  /** "1 = mildly annoying, 100 = absolute catastrophic disaster" */
  promptText: string;
  lowLabel: string;
  highLabel: string;
  /** Every written example, in the order the host has arranged them. */
  examples: Top100ExampleCard[];
  examplesReady: boolean;   // all examples compiled for the reveal
  orderLocked: boolean;     // the host locked the ordering in
  revealed: boolean;        // true numbers are public (results only)
  playerCount: number;
  rankSeconds: number;
}

export interface RevCatCategoryResult {
  playerId: string;
  playerName: string;
  playerColor: string;
  colorIndex: number;
  category: string;
  votes: number;
  isWinner: boolean;
  pointsAdded: number;
}

export interface RevCatPublicState {
  /** The three public items every player has to link. */
  items: string[];
  /** Every invented category has been compiled for the reveal. */
  categoriesReady: boolean;
  totalPlayers: number;
  /** How many different triplets this room has already played. */
  roundsPlayed: number;
}

export interface GtlPublicState {
  category: string;            // broad category of the hidden concept
  conceptWordCount: number;    // how many words the concept has (a fair nudge)
  hintsDealt: number;          // distinct hint angles dealt this round
  totalPlayers: number;
  responsesReady: boolean;     // every response has been compiled for the reveal
  guessesSubmitted: string[];  // playerIds who locked in a guess
  guessSeconds: number;
  revealed: boolean;           // concept is public (results only)
  concept: string | null;      // null until revealed
  correctPlayerIds: string[];  // empty until revealed
}

export type MafiaRole = 'mafia' | 'detective' | 'townsperson';
export type MafiaSide = 'mafia' | 'town';

export interface MafiaTeamSelection {
  playerName: string;
  targetName: string | null; // null until that teammate locks in a victim
}

export interface MafiaInvestigation {
  night: number;
  targetName: string;
  isMafia: boolean;
}

export interface MafiaElimination {
  playerId: string;
  playerName: string;
  night: number;
  cause: 'night-kill' | 'exile';
}

export interface MafiaPublicState {
  nightNumber: number;        // 1-based night currently running (or last resolved)
  dayNumber: number;          // 1-based day currently running (or last resolved)
  mafiaCount: number;         // how many Mafia were dealt this game (public rule info)
  hasDetective: boolean;      // whether a Detective is in play
  alivePlayerIds: string[];
  eliminatedIds: string[];    // everyone out, in timeline order
  eliminations: MafiaElimination[];
  lastNightVictimId: string | null;
  lastNightVictimName: string | null;
  lastExiledId: string | null;
  lastExiledName: string | null;
  pendingNightActions: number; // night actors who still owe a target
  nightSeconds: number;
  daySeconds: number;
  winningSide: MafiaSide | null;
  gameOver: boolean;
}

export interface PhaseResultsData {
  summary: string;
  secretWord?: string;
  category?: string;
  impostorPlayerId?: string;
  impostorName?: string;
  impostorClue?: string;
  impostorCaught?: boolean;
  whyHint?: string;
  voteTallies?: Record<string, number>;
  voteBreakdown?: VoteBreakdownItem[];
  roleReveals?: RoleRevealInfo[];
  standings: PlayerResultStanding[];
  winnerTitle?: string;
  // Avoid the Word-specific
  avoidPlacements?: AvoidPlacement[];
  avoidWinnerNames?: string[];
  avoidWinnerTeamNames?: string[];
  avoidEliminations?: AvoidEliminationRound[];
  avoidRoundsPlayed?: number;
  avoidAnchorNames?: string[];
  // Guess the Link-specific
  gtlConcept?: string;
  gtlCategory?: string;
  gtlGuesses?: GtlGuessResult[];
  gtlHints?: GtlHintShare[];
  gtlCorrectPlayerIds?: string[];
  gtlGiveawayName?: string;
  gtlGiveawayResponse?: string;
  gtlGiveawayNote?: string;
  // Mafia-specific
  mafiaWinningSide?: MafiaSide;
  mafiaLog?: string[];
  mafiaEliminations?: MafiaElimination[];
  // Top 100-specific
  top100PromptText?: string;
  top100LowLabel?: string;
  top100HighLabel?: string;
  top100Category?: string;
  top100Entries?: Top100OrderEntry[];
  top100CorrectPairs?: number;
  top100TotalPairs?: number;
  top100Points?: number;
  // Impostor question mode-specific
  impostorCrewQuestion?: string;
  impostorImpostorQuestion?: string;
  /** One-line explanation of how the two questions differ. */
  impostorQuestionNote?: string;
  /** Team mode only: the round's team leaderboard (individual standings still
   *  carry every player's contribution underneath). */
  teamStandings?: TeamStanding[];
  // Reverse Categories-specific
  revCatItems?: string[];
  revCatCategories?: RevCatCategoryResult[];
  revCatWinnerNames?: string[];
  revCatWinnerCategory?: string | null;
  revCatWinningVotes?: number;
  revCatPointsBest?: number;
  revCatPointsVoter?: number;
}

export interface RoomPublicState {
  roomCode: string;
  hostId: string;
  players: Player[];
  phase: GamePhase;
  selectedGame: GameMetadata | null;
  roundNumber: number;
  totalRounds: number;
  timer: PhaseTimer | null;
  phasePrompt: string;
  phaseSubprompt?: string;
  hasSubmittedInput: string[]; // playerIds who have submitted
  hasVoted: string[]; // playerIds who have cast vote
  revealedAnswers: RevealedAnswer[];
  voteTallies: Record<string, number>; // targetPlayerId -> count
  results: PhaseResultsData | null;
  avoidState: AvoidPublicState | null; // Avoid the Word round state
  mafiaState: MafiaPublicState | null; // Mafia game state
  gtlState: GtlPublicState | null; // Guess the Link game state
  top100State: Top100PublicState | null; // Top 100 spectrum/ranking state
  revCatState: RevCatPublicState | null; // Reverse Categories items/board state
  /** Public host settings per game (how a round plays, never its secrets). */
  gameSettings: GameSettings;
  /** Room-wide play mode: solo (default) or team. */
  playMode: PlayMode;
  /** Room teams. Empty in solo mode. */
  teams: Team[];
  /** Impostor question mode's public round state (null in word mode). */
  impostorQuestionState: ImpostorQuestionState | null;
  /**
   * Whether the server has a usable AI provider for hosted content (custom
   * themes / AI top-ups). Public because the host UI only offers the custom
   * theme field when it can actually be used.
   */
  aiContentAvailable: boolean;
  /** True while a host-authored concept is queued for the next GTL round.
   *  Never carries the concept itself — only that a custom round is loaded. */
  gtlCustomReady?: boolean;
}

export interface PlayerPrivateState {
  role?: string;
  secretWord?: string;
  secretHint?: string;
  isSpecialRole?: boolean;
  specialAccentBg?: boolean;
  secretInstructions?: string;
  inputPlaceholder?: string;
  inputSubmitted?: boolean;
  submittedAnswer?: string;
  voteSubmitted?: boolean;
  votedForPlayerId?: string;
  // Avoid the Word — the question only ever reaches the player whose input is open
  avoidQuestion?: string;
  avoidQuestionCategory?: string;
  avoidAnswerType?: AvoidAnswerType;
  avoidChoices?: string[];
  avoidNumberRange?: { min: number; max: number };
  avoidIsAnchor?: boolean;
  avoidIsActive?: boolean;
  avoidAlive?: boolean;
  avoidAnswerSubmitted?: boolean;
  avoidMyAnswer?: string;
  avoidAnswerPlayerId?: string;
  avoidAnswerPlayerName?: string;
  avoidRoundPoints?: number;
  // Mafia
  mafiaRole?: MafiaRole;
  mafiaRoleLabel?: string;
  mafiaIsAlive?: boolean;
  mafiaTeammateNames?: string[];
  mafiaTeammateIds?: string[];
  mafiaTeamSelections?: MafiaTeamSelection[];
  mafiaCanAct?: boolean;
  mafiaActionLabel?: string;
  mafiaActionSubmitted?: boolean;
  mafiaActionTargetName?: string | null;
  mafiaInvestigations?: MafiaInvestigation[];
  // Guess the Link
  gtlHint?: string;             // this player's own angle on the hidden concept
  gtlHintIndex?: number;        // 1-based position of their hint in the round's deal
  gtlHintCount?: number;        // how many distinct hint angles exist
  gtlCategory?: string;
  gtlConcept?: string;          // only present for the owner once results land
  gtlResponseSubmitted?: boolean;
  gtlResponseText?: string;
  gtlGuessSubmitted?: boolean;
  gtlGuessText?: string;
  gtlGuessCorrect?: boolean;
  gtlPointsAwarded?: number;
  // Top 100
  top100Number?: number;            // this player's secret number (1-100)
  top100PromptText?: string;        // the spectrum, e.g. "1 = ... 100 = ..."
  top100LowLabel?: string;
  top100HighLabel?: string;
  top100Category?: string;
  top100ExampleSubmitted?: boolean;
  top100ExampleText?: string;
  top100CanRank?: boolean;          // host holds the ordering controls
  top100PointsAwarded?: number;
  // Impostor question mode
  impostorQuestion?: string;            // the player's OWN question (Q or Q'), never the other side
  impostorAnswerType?: AnswerType;
  impostorChoices?: string[];
  impostorNumberRange?: { min: number; max: number };
  impostorAnswerSubmitted?: boolean;
  impostorAnswerText?: string;
  impostorAnswerPlayerId?: string;      // 'player' answers: who they named
  impostorAnswerPlayerName?: string;
  // Reverse Categories
  revCatItems?: string[];             // the three items (public info, kept for the round)
  revCatCategoryText?: string;        // this player's own invented category
  revCatCategorySubmitted?: boolean;
  revCatIsWinner?: boolean;
  revCatPointsAwarded?: number;
}

export interface RoomStateUpdatePayload {
  room: RoomPublicState;
  privateState: PlayerPrivateState;
  myPlayerId: string;
}
