/**
 * Content-engine entry point.
 *
 * Import providers from here (`wordProvider`, and later `questionProvider`) and
 * call `releaseRoomContent(roomId)` wherever a room is cleaned up: it drops every
 * per-room shuffle bag, history and AI rate-limit counter.
 */

import { releaseAiRoom } from './aiClient';
import { wordProvider } from './wordProvider';

export function releaseRoomContent(roomId: string): void {
  wordProvider.release(roomId);
  releaseAiRoom(roomId);
}

export { wordProvider, prefetchWordContent, poolSizeFor, validateAiWords } from './wordProvider';
export { ShuffleBag, shuffle, RECENT_GUARD } from './contentBag';
export { getAiStatus, isAiAvailable, reportAiUnavailableOnce, AI_LIMITS } from './aiClient';
export type { ContentProvider, ContentDifficulty, WordItem, WordRequestOptions } from './types';
