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
  | 'mafia-morning'
  | 'mafia-exile'
  | 'reveal-answers'
  | 'guess'
  | 'link-loading'
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
   * does in solo and its points roll up to teams; `shipped` has team-specific
   * rules live today (one guess per team, team-only scoring — Top 100);
   * `native` has team-specific rules planned, so until they ship it is treated
   * as `aggregate`.
   */
  teamSupport: 'aggregate' | 'shipped' | 'native';
  /**
   * Not playable yet: the card is listed with a "Coming Soon" badge, cannot be
   * selected, and the room never launches it. Top 100 is the only shipped game;
   * the rest are marked until they are re-verified against this engine.
   */
  comingSoon?: boolean;
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
  /** Member scores plus `bonusPoints` (see below). Derived, never set directly. */
  score: number;
  memberIds: string[];
  /**
   * Team-only awards: points a game hands to the team rather than to one member
   * (`awardTeamPoints()`), used by games with native team rules such as Top 100.
   * Kept separate so recomputing a team total from its members never erases it.
   */
  bonusPoints?: number;
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

/** Room-wide per-game settings (public strategy, never round secrets). */
export interface GameSettings {
  impostor: ImpostorSettings;
  avoidTheWord: AvoidSettings;
  top100: Top100Settings;
  mafia: MafiaSettings;
  guessTheLink: GtlSettings;
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
  /** 1-based placement; ties share a rank (Top 100 final standings). */
  rank?: number;
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
  /**
   * The comparison result, before any host overrule. The host's overrides live in
   * `AvoidPublicState.overrules` (keyed by player id), so the reveal can show the
   * automatic verdict and the final one separately.
   */
  matched: boolean;
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

/* ────────────────────────────── Top 100 ────────────────────────────────── */

/** Where a list's ranking is scoped to. */
export type Top100Region = 'global' | 'india';
/** What a room draws from ('mixed' alternates global and India). */
export type Top100RegionSetting = Top100Region | 'mixed';

/**
 * What happens when two players (or two teams) guess the same list item:
 *  - 'allow' — both score the item's position (default)
 *  - 'zero'  — nobody scores for an item that was guessed twice
 */
export type Top100DuplicatePolicy = 'allow' | 'zero';

/** One entry of a hidden ranked list. `rank` is 1-based and awards its value. */
export interface Top100Item {
  rank: number;
  name: string;
  /** Accepted alternates (unique across the list — see `npm run validate:top100`). */
  aliases: string[];
}

/**
 * A hidden Top 100 list. Lives on the server only (`shared/data/top100/*.json`);
 * the client never imports these files and never receives the whole list.
 */
export interface Top100List {
  id: string;
  /** Full question text including the metric and the year/basis. */
  question: string;
  /** e.g. 'social-media', 'music', 'movies', 'sports', 'geography'... */
  category: string;
  region: Top100Region;
  /** The year or date the ranking is based on. */
  asOf: string;
  /** Where the ranking comes from. Never invented. */
  source: string;
  /** True only when the data was checked against `source`. */
  verified: boolean;
  /** Exactly 100 entries, ranks 1..100. */
  items: Top100Item[];
}

/** Host settings for Top 100 (public strategy, never round secrets). */
export interface Top100Settings {
  /** Rounds played in one game. */
  roundCount: number;
  /** Seconds to type a guess. Team mode gets at least TOP100_TEAM_MIN_GUESS_SECONDS. */
  guessSeconds: number;
  duplicatePolicy: Top100DuplicatePolicy;
  region: Top100RegionSetting;
  /** Empty means every category is eligible. */
  categories: string[];
}

export const TOP100_SETTINGS_LIMITS = {
  roundCount: { min: 1, max: 10 },
  guessSeconds: { min: 15, max: 120 },
} as const;

/** Captains need time to read their team's suggestions. */
export const TOP100_TEAM_MIN_GUESS_SECONDS = 60;

export const DEFAULT_TOP100_SETTINGS: Top100Settings = {
  roundCount: 5,
  guessSeconds: 45,
  duplicatePolicy: 'allow',
  region: 'mixed',
  categories: [],
};

export const TOP100_DUPLICATE_POLICY_LABELS: Record<Top100DuplicatePolicy, string> = {
  allow: 'Everyone who guesses it scores',
  zero: 'Duplicates score nothing',
};

export const TOP100_REGION_LABELS: Record<Top100RegionSetting, string> = {
  mixed: 'Mixed (global + India)',
  global: 'Global only',
  india: 'India only',
};

/** One team's short suggestion, visible to that team only. */
export interface Top100Suggestion {
  playerId: string;
  playerName: string;
  colorIndex: number;
  text: string;
  /** Arrival order within the round (1-based), used for the fallback pick. */
  sequence: number;
}

/**
 * One scored guess: a player in solo mode, a whole team in team mode. Points are
 * only final once the host has tapped Continue (overrules apply first).
 */
export interface Top100GuessRow {
  /** playerId in solo mode, teamId in team mode. */
  rowId: string;
  /** The player who typed the guess (the captain in team mode). */
  ownerId: string;
  name: string;
  colorIndex: number;
  /** Team mode only. */
  teamName?: string;
  /** What was locked in, or '(no answer)'. */
  text: string;
  submitted: boolean;
  /** 1-100 when the guess is on the list, null when it is not. */
  matchedRank: number | null;
  matchedName: string | null;
  points: number;
  /** Another guess matched the same item. */
  duplicate: boolean;
  /** The host overrode the automatic match for this row. */
  overruled: boolean;
}

/** One revealed list entry. */
export interface Top100SliceEntry {
  rank: number;
  name: string;
}

/**
 * The only slices of a list that ever leave the server: ranks 1-10 and 90-100.
 * Everything in between stays hidden forever.
 */
export interface Top100Slices {
  top: Top100SliceEntry[];
  bottom: Top100SliceEntry[];
}

/**
 * Public Top 100 round state. Carries the question and the guesses board, never
 * the list: only the 1-10 / 90-100 slices appear, and only at results.
 */
export interface Top100PublicState {
  /** The list's id only — never its items. */
  listId: string;
  question: string;
  category: string;
  asOf: string;
  roundNumber: number;
  roundCount: number;
  guessSeconds: number;
  duplicatePolicy: Top100DuplicatePolicy;
  region: Top100RegionSetting;
  /** Everyone who owes a guess: playerIds (solo) or teamIds (team). */
  guesserIds: string[];
  /** Who has locked a guess — ids only. */
  submittedIds: string[];
  /** teamId -> the captain who types this round's guess (team mode only). */
  captains: Record<string, string>;
  /** Guess rows, in guess order. Populated from the guesses reveal onwards. */
  guesses: Top100GuessRow[];
  /** True once points are final (results phase). */
  revealed: boolean;
  /** Revealed 1-10 / 90-100 slices (results only). */
  slices?: Top100Slices;
  /** The last round of the game. */
  finalRound: boolean;
  gameOver: boolean;
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

/* ────────────────────── Guess the Link (three images) ───────────────────── */

/** One of the three clue images of a puzzle. */
export interface LinkItem {
  name: string;
  emoji: string;
  imagePrompt: string;
  imageToken?: string;
}

/** A puzzle as stored in the library. The link itself never reaches clients early. */
export interface GuessLinkPuzzle {
  id: string;
  link: string;
  aliases: string[];
  linkType: 'shared-word' | 'shared-property' | 'shared-category' | 'lateral';
  difficulty: 1 | 2 | 3;
  hint: string;
  items: [LinkItem, LinkItem, LinkItem];
  botWrongGuesses: string[];
  quality: { solverChecked: boolean; imagesChecked: boolean; disabled: boolean };
  createdAt: string;
  useCount: number;
}

export type GtlDifficultySetting = 'easy' | 'medium' | 'hard' | 'mixed';

/** Public Guess the Link settings (strategy, never round secrets). */
export interface GtlSettings {
  roundCount: number;
  roundSeconds: number;
  difficulty: GtlDifficultySetting;
  attempts: number;
  hintEnabled: boolean;
  theme?: string;
}

export const GTL_SETTINGS_LIMITS = {
  roundCount: { min: 1, max: 12 },
  roundSeconds: { min: 20, max: 180 },
  attempts: { min: 1, max: 5 },
} as const;

export const DEFAULT_GTL_SETTINGS: GtlSettings = {
  roundCount: 6,
  roundSeconds: 60,
  difficulty: 'mixed',
  attempts: 3,
  hintEnabled: true,
};

/** A clue as shown during a round (never carries the link). */
export interface GtlClue {
  emoji: string;
  /** Present only from the get-ready step onwards, and only for stored images. */
  imageUrl: string | null;
}

/** One player/team that solved the round. */
export interface GtlSolve {
  rowId: string;
  name: string;
  colorIndex: number;
  points: number;
  seconds: number;
}

/** A wrong guess the host can overrule (results only). */
export interface GtlWrongGuess {
  rowId: string;
  name: string;
  guess: string;
  overruled: boolean;
}

/** One item revealed at results (name only leaves the server here). */
export interface GtlRevealedItem {
  name: string;
  emoji: string;
  imageUrl: string | null;
  caption: string;
}

export interface GtlPublicState {
  /** ready = get-ready/countdown, guessing = live guesses, results = revealed. */
  phase: 'ready' | 'guessing' | 'results';
  roundNumber: number;
  roundCount: number;
  /** Clues for the current round; imageUrl is null for emoji-only puzzles. */
  clues: GtlClue[];
  seconds: number;
  attempts: number;
  hintEnabled: boolean;
  /** Public hint, once half the time has passed with nobody solved. */
  hint: string | null;
  /** Everyone who has solved, in server receive order. */
  solved: GtlSolve[];
  /** playerId/teamId -> attempts used this round. */
  attemptsUsed: Record<string, number>;
  /** Results only. */
  revealed: boolean;
  /** Canonical link, only at results. */
  link: string | null;
  items: GtlRevealedItem[];
  wrongGuesses: GtlWrongGuess[];
  finalRound: boolean;
  gameOver: boolean;
  /** Deprecated legacy fields kept so older screens still type-check. */
  category?: string;
  conceptWordCount?: number;
  hintsDealt?: number;
  totalPlayers?: number;
  responsesReady?: boolean;
  guessesSubmitted: string[];
  guessSeconds?: number;
  concept?: string | null;
  correctPlayerIds?: string[];
}

export type MafiaRole = 'mafia' | 'detective' | 'doctor' | 'townsperson';
export type MafiaSide = 'mafia' | 'town';

/** Public rule info about the deal — never which player holds which role. */
export interface MafiaRoleBreakdown {
  mafia: number;
  detective: boolean;
  doctor: boolean;
  townsperson: number;
}

/**
 * Host settings for Mafia (public strategy, never round secrets). They decide how
 * long each phase runs and how many special roles are dealt, so they can live in
 * the broadcast room state.
 */
export interface MafiaSettings {
  nightSeconds: number;
  discussionSeconds: number;
  voteSeconds: number;
  /** 'auto' follows the player count; a number is a host override. */
  mafiaCount: 'auto' | number;
  detective: boolean;
  doctor: boolean;
  revealRoleOnDeath: boolean;
}

export const MAFIA_MIN_PLAYERS = 4;
export const MAFIA_MAX_PLAYERS = 16;

/** The Doctor is dealt from six players upwards. */
export const MAFIA_DOCTOR_MIN_PLAYERS = 6;
/** The Detective is dealt from four players upwards. */
export const MAFIA_DETECTIVE_MIN_PLAYERS = 4;

export const MAFIA_SETTINGS_LIMITS = {
  nightSeconds: { min: 10, max: 90 },
  discussionSeconds: { min: 30, max: 300 },
  voteSeconds: { min: 10, max: 90 },
} as const;

export const DEFAULT_MAFIA_SETTINGS: MafiaSettings = {
  nightSeconds: 30,
  discussionSeconds: 120,
  voteSeconds: 30,
  mafiaCount: 'auto',
  detective: true,
  doctor: true,
  revealRoleOnDeath: true,
};

export const MAFIA_ROLE_LABELS: Record<MafiaRole, string> = {
  mafia: 'Mafia',
  detective: 'Detective',
  doctor: 'Doctor',
  townsperson: 'Townsperson',
};

/** Which players a role has to hear from each night (for copy, never identities). */
export const MAFIA_ROLE_TAGLINES: Record<MafiaRole, string> = {
  mafia: 'Choose the night’s victim with your family.',
  detective: 'Investigate one player and learn if they are Mafia.',
  doctor: 'Protect one player from the night’s kill — yourself included.',
  townsperson: 'You have no night action. Survive the night and hunt by day.',
};

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
  /** Day the exile happened (null for night kills). */
  day?: number;
}

/** One player who is out, with the role if revealRoleOnDeath was on. */
export interface MafiaDeathAnnouncement {
  playerId: string;
  playerName: string;
  colorIndex: number;
  cause: 'night-kill' | 'exile';
  night: number;
  day: number | null;
  /** Only ever set for a dead player, and only when revealRoleOnDeath is on. */
  role: MafiaRole | null;
  roleLabel: string | null;
}

/** One resolved beat of the game-over recap timeline. */
export interface MafiaRecapEntry {
  kind: 'night' | 'day';
  label: string;
  lines: string[];
}

export type MafiaPublicPhase = 'reveal' | 'night' | 'morning' | 'day' | 'vote' | 'exile' | 'over';

export interface MafiaPublicState {
  phase: MafiaPublicPhase;
  nightNumber: number;        // 1-based night currently running (or last resolved)
  dayNumber: number;          // 1-based day currently running (or last resolved)
  mafiaCount: number;         // how many Mafia were dealt this game (public rule info)
  hasDetective: boolean;      // whether a Detective is in play
  hasDoctor: boolean;         // whether a Doctor is in play
  alivePlayerIds: string[];
  eliminatedIds: string[];    // everyone out, in timeline order
  eliminations: MafiaElimination[];
  deaths: MafiaDeathAnnouncement[];
  lastNightVictimId: string | null;
  lastNightVictimName: string | null;
  lastNightVictimRole: MafiaRole | null;
  lastExiledId: string | null;
  lastExiledName: string | null;
  lastExiledRole: MafiaRole | null;
  /** Count only — never which player confirmed or which role they hold. */
  nightConfirmedCount: number;
  nightActorCount: number;
  pendingNightActions: number; // night actors who still owe a target
  /** Public once the ballot closes (exile screen and game over). */
  voteTally: Record<string, number>;
  voteBreakdown: VoteBreakdownItem[];
  skippedVoteCount: number;
  readyToVoteIds: string[];
  /** The narration line for the current beat (night falls, morning, exile, win). */
  narration: string;
  morningNarration: string;
  exileNarration: string;
  nightSeconds: number;
  discussionSeconds: number;
  voteSeconds: number;
  revealRoleOnDeath: boolean;
  roleBreakdown: MafiaRoleBreakdown;
  winningSide: MafiaSide | null;
  gameOver: boolean;
  /** Populated only at game over: every night and day, start to finish. */
  recap: MafiaRecapEntry[];
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
  /** Final-round flags used by the Guess the Link results screen. */
  finalRound?: boolean;
  gameOver?: boolean;
  winnerIds?: string[];
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
  /** Night-by-night, day-by-day timeline shown on the game-over screen. */
  mafiaRecap?: MafiaRecapEntry[];
  mafiaDeathCount?: number;
  mafiaExileCount?: number;
  // Top 100-specific
  top100Question?: string;
  top100Category?: string;
  top100AsOf?: string;
  /** Where the ranking comes from — shown at results so the table can judge it. */
  top100Source?: string;
  /** The revealed 1-10 / 90-100 slices (results only). */
  top100Slices?: Top100Slices;
  /** Guesses that matched nothing this round (helps the table learn the list). */
  top100Unmatched?: string[];
  /** True when this round ended the game (final standings). */
  top100IsFinal?: boolean;
  top100RoundsPlayed?: number;
  /** Rounds won outright (best single-round score); ties share it. */
  top100RoundWinnerNames?: string[];
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
  top100State: Top100PublicState | null; // Top 100 hidden-list state (never the list itself)
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
  mafiaSide?: MafiaSide;
  mafiaRoleTagline?: string;
  mafiaIsAlive?: boolean;
  mafiaTeammateNames?: string[];
  mafiaTeammateIds?: string[];
  mafiaTeamSelections?: MafiaTeamSelection[];
  /** True while this living player owes a night confirmation. */
  mafiaCanAct?: boolean;
  mafiaActionLabel?: string;
  /** Role-specific prompt (the decoy variant is identical in shape). */
  mafiaActionPrompt?: string;
  mafiaActionSubmitted?: boolean;
  mafiaActionTargetId?: string | null;
  mafiaActionTargetName?: string | null;
  /** Mafia and Doctor may abstain; everybody else confirms a harmless decoy. */
  mafiaCanSkip?: boolean;
  mafiaLastProtectedName?: string | null;
  mafiaInvestigations?: MafiaInvestigation[];
  /** The most recent finding, only while the Detective is alive. */
  mafiaLastFinding?: MafiaInvestigation | null;
  /** Remaining seconds of the running phase, for a reconnecting player. */
  mafiaSecondsRemaining?: number;
  mafiaReadyToVote?: boolean;
  mafiaVoteSubmitted?: boolean;
  mafiaVoteTargetName?: string | null;
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
  /** New image engine: this row's (player or team) remaining attempts + verdicts. */
  gtlAttemptsLeft?: number;
  gtlAttemptsUsed?: number;
  gtlVerdicts?: boolean[];
  gtlSolved?: boolean;
  // Top 100
  top100GuessSubmitted?: boolean;
  top100GuessText?: string;            // the locked guess (own, or the team's)
  top100IsCaptain?: boolean;           // team mode: this player types the guess
  top100CaptainName?: string;          // team mode: who types the team's guess
  top100TeamNames?: string[];          // team mode: the captain's teammates
  /** Team mode: this team's suggestions. Only teammates ever receive them. */
  top100Suggestions?: Top100Suggestion[];
  top100SuggestionsLeft?: number;      // how many more this player may send
  top100MatchedRank?: number | null;   // this player's own result, once revealed
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
