/**
 * Per-room shuffle bag.
 *
 * Each room gets its own shuffled queue of item ids plus a "served" set, so a
 * room never sees the same item twice until the whole pool has been used. When
 * the queue empties it reshuffles, but the first items of a new cycle are never
 * any of the last `recentGuard` items that were served — a reshuffle cannot
 * bounce straight back to the word that was just played.
 *
 * The bag lives in server memory only (never in public room state).
 */

export const RECENT_GUARD = 10;

export class ShuffleBag<T> {
  private readonly items: T[];
  private readonly getId: (item: T) => string;
  private readonly recentGuard: number;
  private queue: T[] = [];
  private served = new Set<string>();
  private recent: string[] = [];
  private known = new Set<string>();

  constructor(
    items: readonly T[],
    getId: (item: T) => string,
    options?: { usedIds?: Iterable<string>; recentIds?: readonly string[]; recentGuard?: number }
  ) {
    this.items = [...items];
    this.getId = getId;
    this.recentGuard = Math.max(0, options?.recentGuard ?? RECENT_GUARD);
    for (const item of this.items) this.known.add(this.getId(item));
    if (options?.usedIds) for (const id of options.usedIds) this.served.add(id);
    if (options?.recentIds) this.recent = [...options.recentIds].slice(-this.recentGuard);
    this.refill();
  }

  /** Size of the underlying pool (not the remaining queue). */
  get size(): number {
    return this.items.length;
  }

  /** How many items are left before the next reshuffle. */
  get remaining(): number {
    return this.queue.length;
  }

  /** How many distinct ids this room has been served. */
  get servedCount(): number {
    return this.served.size;
  }

  has(id: string): boolean {
    return this.known.has(id) || this.served.has(id);
  }

  isUsed(id: string): boolean {
    return this.served.has(id);
  }

  /**
   * Pops the next item, reshuffling first when the queue has run dry.
   * Returns null only when the pool itself is empty.
   */
  next(): T | null {
    if (this.queue.length === 0) {
      this.refill();
      if (this.queue.length === 0) return null;
    }
    const item = this.queue.shift() as T;
    const id = this.getId(item);
    this.served.add(id);
    this.recent = [...this.recent, id].slice(-this.recentGuard);
    return item;
  }

  /**
   * Merges freshly generated items into the pool and the live queue
   * (AI top-ups). Ids the bag already knows are ignored.
   */
  add(items: readonly T[]): number {
    let added = 0;
    const fresh: T[] = [];
    for (const item of items) {
      const id = this.getId(item);
      if (this.known.has(id) || this.served.has(id)) continue;
      this.known.add(id);
      fresh.push(item);
      added += 1;
    }
    this.items.push(...fresh);
    this.queue.push(...shuffle(fresh));
    return added;
  }

  /** Cumulative history, newest last — used as the AI exclusion list. */
  recentIds(): string[] {
    return [...this.recent];
  }

  /** Every id the room has ever been served. */
  usedIds(): string[] {
    return [...this.served];
  }

  private refill(): void {
    if (this.items.length === 0) return;

    // Items the room has never been served come first, so rebuilding the bag
    // (for example after the host switches difficulty) can never replay a word
    // the room has already played while unused words remain.
    const unserved: T[] = [];
    const alreadyServed: T[] = [];
    for (const item of this.items) {
      if (this.served.has(this.getId(item))) alreadyServed.push(item);
      else unserved.push(item);
    }
    const order = [...shuffle(unserved), ...shuffle(alreadyServed)];

    // Keep the head of a new cycle clear of the items that were just served,
    // so a reshuffle can never repeat a recent item straight away.
    if (this.recentGuard > 0 && this.served.size > 0) {
      const recentSet = new Set(this.recent);
      const guard = Math.min(this.recentGuard, Math.max(0, order.length - recentSet.size));
      for (let i = 0; i < guard; i += 1) {
        if (!recentSet.has(this.getId(order[i]))) continue;
        // Find a later slot holding an item that was not recently served.
        let swapAt = -1;
        for (let j = guard; j < order.length; j += 1) {
          if (!recentSet.has(this.getId(order[j]))) {
            swapAt = j;
            break;
          }
        }
        if (swapAt === -1) break;
        [order[i], order[swapAt]] = [order[swapAt], order[i]];
      }
    }

    this.queue = order;
  }
}

/** Fisher-Yates shuffle; returns a new array. */
export function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
