export type CacheEntry<T> = { value: T; storedAt: number };

/** Small TTL cache; the oldest entry is dropped first once `max` entries are held. */
export class TtlCache<T> {
  private entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly max = 200,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string, ttlMs: number): CacheEntry<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (this.now() - entry.storedAt >= ttlMs) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, value: T): CacheEntry<T> {
    this.entries.delete(key);
    const entry = { value, storedAt: this.now() };
    this.entries.set(key, entry);
    if (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value!);
    return entry;
  }

  /** Drops every entry whose key starts with the prefix (one unit's cached searches). */
  deletePrefix(prefix: string) {
    for (const key of [...this.entries.keys()])
      if (key.startsWith(prefix)) this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }
}
