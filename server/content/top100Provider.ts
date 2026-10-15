/**
 * Top 100 list provider.
 *
 * The hidden ranked lists are bundled JSON (`shared/data/top100/*.json`) and are
 * served through this provider so no room repeats a list and the whole ranking
 * never leaves the server. The provider hands the *engine* a Top100List; the
 * engine decides which slices are ever allowed onto the wire.
 *
 * Room rules:
 *  - **No repeats** — each room gets its own shuffle order over the eligible
 *    list ids plus a served set. Nothing repeats until the pool is exhausted.
 *  - **Category variety** — the next list avoids the previous round's category
 *    whenever another category is still available.
 *  - **Region mix** — with `region: 'mixed'` the provider alternates global and
 *    India lists whenever both are available.
 *
 * Host filters: `region` ('global' | 'india' | 'mixed') and a `categories`
 * allow-list (empty = everything). `TOP100_ONLY_VERIFIED=true` drops every list
 * that was not checked against its cited source.
 */

import { Top100List, Top100Region, Top100RegionSetting } from '../../shared/types';
import { TOP100_CATEGORY_IDS } from '../../shared/data/top100Categories';
import { shuffle } from './contentBag';
import { ContentProvider } from './types';
import architectureData from '../../shared/data/top100/architecture.json';
import brandsData from '../../shared/data/top100/brands.json';
import foodData from '../../shared/data/top100/food.json';
import geographyData from '../../shared/data/top100/geography.json';
import literatureData from '../../shared/data/top100/literature.json';
import moviesData from '../../shared/data/top100/movies.json';
import musicData from '../../shared/data/top100/music.json';
import namesData from '../../shared/data/top100/names.json';
import socialMediaData from '../../shared/data/top100/social-media.json';
import sportsData from '../../shared/data/top100/sports.json';

export interface Top100RequestOptions extends Record<string, unknown> {
  region?: Top100RegionSetting;
  /** Empty array (or omitted) means every category is eligible. */
  categories?: string[];
}

/** The structure a bundled list must satisfy before the provider will serve it. */
export function isUsableTop100List(candidate: unknown): candidate is Top100List {
  if (!candidate || typeof candidate !== 'object') return false;
  const list = candidate as Top100List;
  if (typeof list.id !== 'string' || !list.id) return false;
  if (typeof list.question !== 'string' || !list.question.trim()) return false;
  if (typeof list.category !== 'string' || !list.category) return false;
  if (typeof list.asOf !== 'string' || !list.asOf.trim()) return false;
  if (typeof list.source !== 'string' || !list.source.trim()) return false;
  if (list.region !== 'global' && list.region !== 'india') return false;
  if (!Array.isArray(list.items) || list.items.length !== 100) return false;

  const ranks = new Set<number>();
  for (const item of list.items) {
    if (!item || typeof item.name !== 'string' || !item.name.trim()) return false;
    if (!Number.isInteger(item.rank) || item.rank < 1 || item.rank > 100) return false;
    if (ranks.has(item.rank)) return false;
    ranks.add(item.rank);
    if (item.aliases !== undefined && !Array.isArray(item.aliases)) return false;
  }
  return ranks.size === 100;
}

/** Reads every bundled list and keeps only the structurally valid ones. */
function loadBundledLists(): Top100List[] {
  const raw: unknown[] = [
    ...geographyData.lists,
    ...architectureData.lists,
    ...moviesData.lists,
    ...musicData.lists,
    ...socialMediaData.lists,
    ...foodData.lists,
    ...namesData.lists,
    ...sportsData.lists,
    ...brandsData.lists,
    ...literatureData.lists,
  ];

  const lists: Top100List[] = [];
  const seen = new Set<string>();
  raw.forEach((entry) => {
    if (!isUsableTop100List(entry)) {
      console.warn('[top100] skipping invalid bundled list:', (entry as { id?: string })?.id ?? 'unknown');
      return;
    }
    if (seen.has(entry.id)) {
      console.warn('[top100] skipping duplicate list id:', entry.id);
      return;
    }
    seen.add(entry.id);
    // Normalise the optional alias arrays so the matcher never has to.
    lists.push({
      ...entry,
      items: entry.items.map((item) => ({
        rank: item.rank,
        name: item.name.trim(),
        aliases: (item.aliases ?? []).map((alias) => String(alias).trim()).filter(Boolean),
      })),
    });
  });

  return lists;
}

/** Every bundled, structurally valid list. Server-only. */
export const TOP100_LISTS: Top100List[] = loadBundledLists();

/** `TOP100_ONLY_VERIFIED=true` restricts play to source-checked lists. */
export function top100VerifiedOnly(): boolean {
  const raw = (process.env.TOP100_ONLY_VERIFIED || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function readTop100Region(value: unknown): Top100RegionSetting {
  return value === 'global' || value === 'india' || value === 'mixed' ? value : 'mixed';
}

export function readTop100Categories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(TOP100_CATEGORY_IDS);
  return [...new Set(value.map((entry) => String(entry)).filter((entry) => known.has(entry)))];
}

/** True when `list` may be served to a room with these options. */
export function isTop100ListEligible(
  list: Top100List,
  opts: Top100RequestOptions = {},
  verifiedOnly: boolean = top100VerifiedOnly()
): boolean {
  if (verifiedOnly && !list.verified) return false;

  const region = readTop100Region(opts.region);
  if (region !== 'mixed' && list.region !== region) return false;

  const categories = readTop100Categories(opts.categories);
  if (categories.length > 0 && !categories.includes(list.category)) return false;

  return true;
}

/** Lists a room with these options could be served (used by the tests + UI). */
export function top100PoolSizeFor(opts: Top100RequestOptions = {}): number {
  return TOP100_LISTS.filter((list) => isTop100ListEligible(list, opts)).length;
}

/** Distinct categories present in the bundled bank (public: no rankings). */
export function top100Categories(): string[] {
  return [...new Set(TOP100_LISTS.map((list) => list.category))].sort();
}

interface Top100RoomBag {
  /** Eligibility signature: changing host settings rebuilds the order. */
  signature: string;
  /** Remaining shuffled list ids. */
  order: string[];
  /** Every id this room has already been served. */
  served: Set<string>;
  /** Newest-last history of served ids (kept for the reshuffle guard). */
  recent: string[];
  /** Ids the room was already served, so a rebuild can never replay them. */
  usedIds: string[];
  lastCategory?: string;
  lastRegion?: Top100Region;
  poolSize: number;
}

function poolSignature(pool: Top100List[], verifiedOnly: boolean): string {
  const region = [...new Set(pool.map((list) => list.region))].sort().join('+');
  const categories = [...new Set(pool.map((list) => list.category))].sort().join('+');
  return `${verifiedOnly ? 'verified' : 'all'}|${region}|${categories}|${pool.length}`;
}

/**
 * Picks the next list: the first candidate in shuffled order that satisfies the
 * variety rules, falling back to the head of the queue when no candidate does.
 */
function pickFromOrder(
  room: Top100RoomBag,
  byId: Map<string, Top100List>
): Top100List | null {
  if (room.order.length === 0) return null;

  const regionMixed = new Set(
    room.order.map((id) => byId.get(id)?.region).filter(Boolean) as Top100Region[]
  ).size > 1;

  const categoryDiffers = (id: string) => {
    const list = byId.get(id);
    return Boolean(list && (!room.lastCategory || list.category !== room.lastCategory));
  };
  const regionDiffers = (id: string) => {
    const list = byId.get(id);
    return Boolean(list && room.lastRegion && list.region !== room.lastRegion);
  };

  let chosenId: string | undefined;
  if (room.lastCategory) {
    chosenId =
      (regionMixed ? room.order.find((id) => categoryDiffers(id) && regionDiffers(id)) : undefined) ??
      room.order.find(categoryDiffers);
  }
  if (!chosenId && room.lastRegion) {
    chosenId = regionMixed ? room.order.find(regionDiffers) : undefined;
  }
  if (!chosenId) chosenId = room.order[0];

  const list = byId.get(chosenId);
  if (!list) return null;

  room.order = room.order.filter((id) => id !== chosenId);
  room.served.add(chosenId);
  room.recent = [...room.recent, chosenId].slice(-10);
  room.lastCategory = list.category;
  room.lastRegion = list.region;
  return list;
}

class Top100Provider implements ContentProvider<Top100List> {
  private rooms = new Map<string, Top100RoomBag>();

  async next(roomId: string, opts: Top100RequestOptions = {}): Promise<Top100List> {
    const verifiedOnly = top100VerifiedOnly();
    const pool = TOP100_LISTS.filter((list) => isTop100ListEligible(list, opts, verifiedOnly));

    // A pool can only be empty when the host's filters exclude everything (the
    // bank always ships eligible lists). Relax to the full bank so a room is
    // never stranded by a stale setting.
    const effectivePool = pool.length > 0 ? pool : TOP100_LISTS;
    const byId = new Map(effectivePool.map((list) => [list.id, list]));
    const signature = poolSignature(effectivePool, verifiedOnly);
    const existing = this.rooms.get(roomId);

    let room: Top100RoomBag;
    if (!existing || existing.signature !== signature) {
      const usedIds = existing?.usedIds ?? [];
      const unserved = effectivePool.filter((list) => !usedIds.includes(list.id));
      room = {
        signature,
        // Unused lists always come before already-served ones, so switching
        // filters mid-session cannot replay a list while fresh ones remain.
        order: [
          ...shuffle(unserved.map((list) => list.id)),
          ...shuffle(effectivePool.filter((list) => usedIds.includes(list.id)).map((list) => list.id)),
        ],
        served: new Set(usedIds),
        recent: existing?.recent ?? [],
        usedIds,
        lastCategory: existing?.lastCategory,
        lastRegion: existing?.lastRegion,
        poolSize: effectivePool.length,
      };
      this.rooms.set(roomId, room);
    } else {
      room = existing;
    }

    if (room.order.length === 0) {
      // Pool exhausted: start a fresh cycle over the whole pool, never leading
      // with the list that was just served.
      const recentSet = new Set(room.recent);
      room.order = shuffle(effectivePool.map((list) => list.id)).sort(
        (a, b) => Number(recentSet.has(a)) - Number(recentSet.has(b))
      );
      room.served = new Set();
      room.usedIds = [];
      room.lastCategory = undefined;
      room.lastRegion = undefined;
    }

    const picked = pickFromOrder(room, byId);
    room.usedIds = [...room.served];
    // Defensive: the bank is validated, so this should never be reachable.
    return picked ?? TOP100_LISTS[0];
  }

  release(roomId: string): void {
    this.rooms.delete(roomId);
  }

  /** Test hook: how many lists this room has been served. */
  servedCount(roomId: string): number {
    return this.rooms.get(roomId)?.served.size ?? 0;
  }

  /** Test hook: the last category/region served to a room. */
  lastServed(roomId: string): { category?: string; region?: Top100Region } {
    const room = this.rooms.get(roomId);
    return { category: room?.lastCategory, region: room?.lastRegion };
  }
}

export const top100Provider = new Top100Provider();

/** Test hook: forget every room's bag. */
export function resetTop100ProviderForTests(): void {
  (top100Provider as unknown as { rooms: Map<string, Top100RoomBag> }).rooms.clear();
}
