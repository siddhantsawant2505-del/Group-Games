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
  | 'reveal-answers'
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
}

export interface RoomStateUpdatePayload {
  room: RoomPublicState;
  privateState: PlayerPrivateState;
  myPlayerId: string;
}
