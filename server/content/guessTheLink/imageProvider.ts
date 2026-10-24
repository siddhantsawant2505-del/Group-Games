/**
 * Image generation for Guess the Link.
 *
 * Text models cannot draw, so clues use a separate adapter. The interface stays
 * deliberately tiny (one method) so another vendor can be dropped in later.
 * Keys are read from the environment on the server only and never logged.
 */

export interface ImageProvider {
  readonly name: 'gemini' | 'mock' | 'none';
  /** True when this provider can actually draw a clue. */
  readonly enabled: boolean;
  generate(prompt: string, opts: { size: number; seed?: number }): Promise<Buffer>;
}

/** Shared style so every clue in the library looks like one set. */
export const STYLE_PREFIX =
  'A clean flat vector illustration, single centered subject, plain soft pastel background, ' +
  'bright friendly colours, simple shapes, thick soft outlines, no text, no letters, no numbers, ' +
  'no logos, no watermarks, no real people, no copyrighted characters. Subject: ';

export const LINK_IMAGE_TIMEOUT_MS = readInt('LINK_IMAGE_TIMEOUT_MS', 25_000);
export const LINK_IMAGE_DAILY_BUDGET = readInt('LINK_IMAGE_DAILY_BUDGET', 300);
export const IMAGE_CONCURRENCY = readInt('IMAGE_CONCURRENCY', 3);
export const LINK_IMAGE_CHECK = (process.env.LINK_IMAGE_CHECK || '').toLowerCase() === 'true';

function readInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** A tile-sized sparkle placeholder, used by IMAGE_PROVIDER=mock. */
function placeholderSvg(prompt: string, size: number, seed: number): Buffer {
  const hue = (seed * 47 + prompt.length * 13) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="hsl(${hue} 55% 88%)"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.28}" fill="hsl(${(hue + 40) % 360} 65% 62%)"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.16}" fill="hsl(${hue} 80% 96%)"/>
</svg>`;
  return Buffer.from(svg);
}

const mockProvider: ImageProvider = {
  name: 'mock',
  enabled: true,
  async generate(prompt, opts) {
    return placeholderSvg(prompt, opts.size, opts.seed ?? 1);
  },
};

const noneProvider: ImageProvider = {
  name: 'none',
  enabled: false,
  async generate() {
    throw new Error('Image generation is disabled (IMAGE_PROVIDER=none).');
  },
};

/** Gemini's image-capable generateContent endpoint, called with plain fetch. */
function createGeminiProvider(apiKey: string, model: string): ImageProvider {
  return {
    name: 'gemini',
    enabled: true,
    async generate(prompt, opts) {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LINK_IMAGE_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${STYLE_PREFIX}${prompt}` }] }],
            generationConfig: {
              responseModalities: ['IMAGE'],
              imageConfig: { aspectRatio: '1:1', imageSize: `${opts.size}x${opts.size}` },
            },
          }),
        });
        if (!response.ok) {
          throw new Error(`image provider HTTP ${response.status}`);
        }
        const payload: any = await response.json();
        const parts: any[] = payload?.candidates?.[0]?.content?.parts ?? [];
        const inline = parts.find((part) => part?.inlineData?.data)?.inlineData;
        if (!inline?.data) throw new Error('image provider returned no image data');
        return Buffer.from(inline.data, 'base64');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

let cached: ImageProvider | null = null;

/**
 * The configured provider. `none` is the safe default: without a key the game
 * plays on emoji tiles instead of pretending to draw.
 */
export function getImageProvider(): ImageProvider {
  if (cached) return cached;
  const configured = (process.env.IMAGE_PROVIDER || '').toLowerCase();
  const apiKey = process.env.IMAGE_API_KEY || process.env.GEMINI_API_KEY || '';
  const model = process.env.IMAGE_MODEL || '';

  if (configured === 'mock') cached = mockProvider;
  else if (configured === 'none') cached = noneProvider;
  else if ((configured === 'gemini' || (!configured && apiKey)) && apiKey && model) {
    cached = createGeminiProvider(apiKey, model);
  } else cached = noneProvider;
  return cached;
}

export function resetImageProviderForTests(): void {
  cached = null;
}

/** One retry per clue, then the caller stores the item as image-missing. */
export async function generateClueImage(
  prompt: string,
  seed: number
): Promise<Buffer | null> {
  const provider = getImageProvider();
  if (!provider.enabled) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const buffer = await provider.generate(prompt, { size: 512, seed: seed + attempt });
      if (buffer && buffer.length > 0) return buffer;
    } catch {
      // Swallowed on purpose: a missing clue degrades to its emoji tile.
    }
  }
  return null;
}

/** Global image-call semaphore plus a per-day budget, shared by all rooms. */
export class ImageBudget {
  private active = 0;
  private waiting: (() => void)[] = [];
  private used = 0;
  private day = new Date().toISOString().slice(0, 10);

  constructor(
    private readonly concurrency = IMAGE_CONCURRENCY,
    private readonly dailyLimit = LINK_IMAGE_DAILY_BUDGET
  ) {}

  get usedToday(): number {
    this.rollDay();
    return this.used;
  }

  get available(): boolean {
    this.rollDay();
    return this.used < this.dailyLimit;
  }

  /** Reserves a slot, waiting for the cap instead of dropping the work. */
  async run<T>(task: () => Promise<T>): Promise<T | null> {
    this.rollDay();
    if (this.used >= this.dailyLimit) return null;
    this.used += 1;
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      const next = this.waiting.shift();
      if (next) next();
    }
  }

  private rollDay() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
  }
}

export const imageBudget = new ImageBudget();
