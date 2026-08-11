type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class MemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number) {
    const now = Date.now();

    // Query-string based caches should never be allowed to grow without a
    // bound. Remove expired entries first, then evict the oldest insertion if
    // the namespace is still full.
    for (const [entryKey, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) this.store.delete(entryKey);
    }
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: now + Math.max(0, ttlMs),
    });
  }

  deletePrefix(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear() {
    this.store.clear();
  }
}

export const appCache = new MemoryCache();

export const stableCacheKey = (prefix: string, params: Record<string, unknown>) => {
  const normalized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join('|');

  return normalized ? `${prefix}:${normalized}` : prefix;
};
