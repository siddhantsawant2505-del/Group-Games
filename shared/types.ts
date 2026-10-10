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
}

export type GamePhase =
  | 'lobby'
  | 'game-select'
  | 'reveal'
  | 'input'
  | 'atw-describe'
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
}

export interface PhaseTimer {
  durationSeconds: number;
  endsAtTimestamp: number;
  remainingSeconds: number;
}

export interface RevealedAnswer {
  playerId: string;
  playerName: string;
  playerColor: string;
  colorIndex: number;
  answerText: string;
  revealed: boolean;
  subtext?: string;
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

export interface AtwTurnResult {
  playerId: string;
  playerName: string;
  playerColor: string;
  colorIndex: number;
  subject: string;
  forbidden: [string, string, string];
  success: boolean; // true = timer ran out without confirmed buzz; false = buzzed out
  buzzCount: number;
  pointsAdded: number;
  buzzedByNames?: string[]; // players whose buzzes were confirmed
}

export interface AtwPublicState {
  describerIndex: number;        // index into room.players of current describer
  describerPlayerId: string;     // empty string when the round has no turns left
  turnResults: AtwTurnResult[];  // completed turns this round
  buzzedPlayerIds: string[];     // who has buzzed this turn (cleared per turn)
  buzzConfirmed: boolean;        // majority or host override confirmed the buzz
  totalTurns: number;            // number of players who will describe this round
  turnNumber: number;            // 1-based index of the active turn
  requiredBuzzes: number;        // buzzes needed to auto-confirm the active turn
  turnActive: boolean;           // a describing turn is currently running
  turnSeconds: number;           // seconds each describer gets on their turn
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
  // ATW-specific
  atwTurnResults?: AtwTurnResult[];
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
  atwState: AtwPublicState | null; // Avoid the Word game state
  mafiaState: MafiaPublicState | null; // Mafia game state
  gtlState: GtlPublicState | null; // Guess the Link game state
  top100State: Top100PublicState | null; // Top 100 spectrum/ranking state
  revCatState: RevCatPublicState | null; // Reverse Categories items/board state
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
  // Avoid the Word
  atwSubject?: string;
  atwForbidden?: [string, string, string];
  atwCategory?: string;
  atwIsDescriber?: boolean;
  atwBuzzed?: boolean;
  atwRoundPoints?: number;
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
