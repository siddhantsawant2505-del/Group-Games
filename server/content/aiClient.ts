/**
 * Server-side AI client for the content engine.
 *
 * Wraps the Gemini provider that is already configured for this project
 * (`GEMINI_API_KEY` in `.env`). Nothing here is ever sent to a client: the
 * client only receives finished content through the normal room/private-state
 * channels, and the API key never leaves this module.
 *
 * Behaviour contract:
 *  - 12 second timeout, one retry, strict JSON output.
 *  - Per-room rate limit (20 generation calls per rolling hour).
 *  - When no usable key is configured the client reports "unavailable" once and
 *    every caller silently falls back to bundled content: no errors, no log spam.
 */

import { GoogleGenAI } from '@google/genai';

// Gemini rejects any deadline below 10s ("Manually set deadline 8s is too short"),
// so the request timeout has to stay above that floor.
const TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 2;
const RATE_LIMIT_MAX_CALLS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

export interface AiStatus {
  available: boolean;
  reason: string;
}

interface RoomAiState {
  callTimestamps: number[];
  announcedFailure: boolean;
  inFlight: boolean;
}

const roomState = new Map<string, RoomAiState>();
const loggedOnce = new Set<string>();

let client: GoogleGenAI | null = null;
let status: AiStatus | null = null;

/** Logs a line at most once per key, so repeated calls cannot spam the console. */
function logOnce(key: string, message: string): void {
  if (loggedOnce.has(key)) return;
  loggedOnce.add(key);
  console.log(message);
}

function looksLikeRealKey(key: string): boolean {
  // AI Studio issues classic `AIza…` keys and newer `AQ.…` keys. The shipped
  // .env carries a placeholder, and placeholder values must not produce failing
  // network calls on every round.
  if (/placeholder|your|example|changeme/i.test(key)) return false;
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(key) || /^AQ\.[0-9A-Za-z._-]{20,}$/.test(key);
}

export function getAiStatus(): AiStatus {
  if (status) return status;

  const key = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (process.env.CONTENT_AI_DISABLED === 'true') {
    status = { available: false, reason: 'disabled by CONTENT_AI_DISABLED' };
  } else if (!key) {
    status = { available: false, reason: 'no GEMINI_API_KEY configured' };
  } else if (!looksLikeRealKey(key)) {
    status = { available: false, reason: 'GEMINI_API_KEY is a placeholder or not a Gemini key' };
  } else {
    status = { available: true, reason: 'ready' };
  }
  return status;
}

export function isAiAvailable(): boolean {
  return getAiStatus().available;
}

/**
 * Reports an unusable provider exactly once (never per round), so operators see
 * the reason without the console filling up once the bag runs low.
 */
export function reportAiUnavailableOnce(): void {
  const current = getAiStatus();
  if (current.available) return;
  logOnce(
    'ai-unavailable',
    `[content-ai] AI content unavailable (${current.reason}) — serving bundled content only.`
  );
}

/** Test seam: forget the cached status/client so env changes are picked up. */
export function resetAiClientForTests(): void {
  client = null;
  status = null;
  loggedOnce.clear();
  roomState.clear();
}

function getClient(): GoogleGenAI | null {
  const current = getAiStatus();
  if (!current.available) {
    logOnce(
      'ai-unavailable',
      `[content-ai] AI content unavailable (${current.reason}) — serving bundled content only.`
    );
    return null;
  }
  if (!client) {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
    client = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
  }
  return client;
}

function getRoomState(roomId: string): RoomAiState {
  let state = roomState.get(roomId);
  if (!state) {
    state = { callTimestamps: [], announcedFailure: false, inFlight: false };
    roomState.set(roomId, state);
  }
  return state;
}

function takeRateLimitToken(roomId: string): boolean {
  const state = getRoomState(roomId);
  const now = Date.now();
  state.callTimestamps = state.callTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (state.callTimestamps.length >= RATE_LIMIT_MAX_CALLS) return false;
  state.callTimestamps.push(now);
  return true;
}

export function releaseAiRoom(roomId: string): void {
  roomState.delete(roomId);
}

export function isAiBatchInFlight(roomId: string): boolean {
  return getRoomState(roomId).inFlight;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** Pulls the first JSON array out of a model response, tolerating code fences. */
export function extractJsonArray(text: string): unknown[] | null {
  if (typeof text !== 'string' || !text.trim()) return null;
  const cleaned = text.replace(/```json/gi, '```').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface AiJsonRequest {
  roomId: string;
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  /** Human-readable label used in throttled logs, e.g. "words" or "questions". */
  label: string;
}

/**
 * Requests a strict-JSON array from the model. Returns null on any failure
 * (unavailable, rate limited, timeout, transport error, unparseable output) so
 * callers always keep serving bundled content.
 */
export async function generateJsonArray(request: AiJsonRequest): Promise<unknown[] | null> {
  const ai = getClient();
  if (!ai) return null;

  const state = getRoomState(request.roomId);
  if (state.inFlight) return null;
  if (!takeRateLimitToken(request.roomId)) {
    logOnce(
      `ai-ratelimit-${request.roomId}`,
      `[content-ai] Room hit its AI generation limit for this hour — bundled ${request.label} will be used.`
    );
    return null;
  }

  state.inFlight = true;
  let lastError = '';
  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: MODEL,
            contents: request.prompt,
            config: {
              systemInstruction: request.systemInstruction,
              responseMimeType: 'application/json',
              temperature: request.temperature ?? 0.9,
            },
          }),
          TIMEOUT_MS
        );
        const text =
          typeof response.text === 'string'
            ? response.text
            : (response.candidates?.[0]?.content?.parts || [])
                .map((part) => part.text || '')
                .join('');
        const parsed = extractJsonArray(text);
        if (parsed && parsed.length > 0) return parsed;
        lastError = 'empty or unparseable response';
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!state.announcedFailure) {
      state.announcedFailure = true;
      console.log(
        `[content-ai] ${request.label} generation failed (${lastError}) — keeping bundled content.`
      );
    }
    return null;
  } finally {
    state.inFlight = false;
  }
}

export const AI_LIMITS = {
  TIMEOUT_MS,
  MAX_ATTEMPTS,
  RATE_LIMIT_MAX_CALLS,
  RATE_LIMIT_WINDOW_MS,
  MODEL,
} as const;
