/**
 * Clue image storage. Files live under LIBRARY_DIR/images with a random token
 * as the name, so neither the file name nor the URL reveals the item or link.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const LIBRARY_DIR =
  process.env.LIBRARY_DIR || path.join(process.cwd(), 'data', 'puzzle-library');
export const IMAGES_DIR = path.join(LIBRARY_DIR, 'images');
export const INDEX_FILE = path.join(LIBRARY_DIR, 'index.json');
export const MAX_IMAGE_BYTES = 200 * 1024;

interface StoredImage {
  file: string;
  mime: string;
  bytes: number;
}

/** token -> stored file. Rebuilt from the index and from disk on start. */
const images = new Map<string, StoredImage>();

function ensureDirs() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

async function postProcess(buffer: Buffer): Promise<{ data: Buffer; ext: string; mime: string }> {
  try {
    const sharpModule = await import('sharp');
    const sharp = (sharpModule as any).default ?? sharpModule;
    const data = await sharp(buffer)
      .resize(512, 512, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
    return { data, ext: 'webp', mime: 'image/webp' };
  } catch {
    // Sharp is optional (offline dev / mock provider); keep the raw bytes.
    const isSvg = buffer.subarray(0, 200).toString('utf8').includes('<svg');
    return {
      data: buffer,
      ext: isSvg ? 'svg' : 'png',
      mime: isSvg ? 'image/svg+xml' : 'image/png',
    };
  }
}

/**
 * Writes one clue image and returns its random token. The token is what the
 * client sees in the URL; the puzzle keeps it privately until results.
 */
export async function storeImage(buffer: Buffer): Promise<{ token: string; bytes: number }> {
  ensureDirs();
  const token = crypto.randomBytes(16).toString('hex');
  const processed = await postProcess(buffer);
  const file = `${token}.${processed.ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, file), processed.data);
  images.set(token, { file, mime: processed.mime, bytes: processed.data.length });
  return { token, bytes: processed.data.length };
}

/** Registers a token that the library index already references. */
export function registerImageToken(token: string, file: string, mime: string, bytes = 0) {
  if (!token || !file) return;
  images.set(token, { file, mime, bytes });
}

export function hasImageToken(token: string): boolean {
  return images.has(token);
}

/** Serves only tokens the library knows about — no directory listing. */
export async function readImage(
  token: string
): Promise<{ data: Buffer; mime: string } | null> {
  const entry = images.get(token);
  if (!entry) return null;
  try {
    return { data: await fs.promises.readFile(path.join(IMAGES_DIR, entry.file)), mime: entry.mime };
  } catch {
    return null;
  }
}

/** Scans the images folder so a restart can still serve existing clues. */
export function loadImageDirectory() {
  ensureDirs();
  try {
    for (const file of fs.readdirSync(IMAGES_DIR)) {
      const token = file.split('.')[0];
      if (!/^[a-f0-9]{32}$/.test(token)) continue;
      const mime = file.endsWith('.svg')
        ? 'image/svg+xml'
        : file.endsWith('.webp')
        ? 'image/webp'
        : 'image/png';
      images.set(token, { file, mime, bytes: 0 });
    }
  } catch {
    // A missing directory is normal on a fresh checkout.
  }
}

export function imageTokenCount(): number {
  return images.size;
}
