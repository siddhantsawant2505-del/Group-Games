/**
 * Content-engine entry point.
 *
 * Import providers from here (`wordProvider`, `questionProvider`) and call
 * `releaseRoomContent(roomId)` wherever a room is cleaned up: it drops every
 * per-room shuffle bag, history and AI rate-limit counter.
 */

import { releaseAiRoom } from './aiClient';
import { avoidQuestionProvider } from './avoidQuestionProvider';
import { questionProvider } from './questionProvider';
import { top100Provider } from './top100Provider';
import { wordProvider } from './wordProvider';

export function releaseRoomContent(roomId: string): void {
  wordProvider.release(roomId);
  questionProvider.release(roomId);
  avoidQuestionProvider.release(roomId);
  top100Provider.release(roomId);
  releaseAiRoom(roomId);
}

export {
  wordProvider,
  prefetchWordContent,
  poolSizeFor,
  validateAiWords,
  randomCorpusWord,
  isCommonWord,
  isBlockedWord,
  hasCommonnessData,
} from './wordProvider';
export {
  questionProvider,
  prefetchQuestionContent,
  pairPoolSizeFor,
  validateQuestionPair,
  validateAiPairs,
  textSimilarity,
  KIND_ANSWER_TYPE,
  SEED_QUESTION_PAIRS,
  QUESTION_BAG_LOW_WATER_MARK,
  QUESTION_AI_BATCH_SIZE,
  resetQuestionProviderForTests,
} from './questionProvider';
export {
  avoidQuestionProvider,
  prefetchAvoidContent,
  validateAvoidQuestion,
  validateAiAvoidQuestions,
  isAnswerSpaceLargeEnough,
  isQuestionEligible,
  avoidPoolSizeFor,
  seedCounts as avoidSeedCounts,
  SEED_AVOID_QUESTIONS,
  AVOID_AI_BATCH_SIZE,
  AVOID_BAG_LOW_WATER_MARK,
  resetAvoidProviderForTests,
} from './avoidQuestionProvider';
export {
  top100Provider,
  TOP100_LISTS,
  top100Categories,
  top100PoolSizeFor,
  resetTop100ProviderForTests,
} from './top100Provider';
export { ShuffleBag, shuffle, RECENT_GUARD } from './contentBag';
export { getAiStatus, isAiAvailable, reportAiUnavailableOnce, AI_LIMITS } from './aiClient';
export {
  sanitizeTheme,
  readDifficulty,
  normalizeContentWord,
  DEFAULT_CONTENT_DIFFICULTY,
} from './types';
export type {
  ContentProvider,
  ContentDifficulty,
  WordItem,
  WordRequestOptions,
} from './types';
