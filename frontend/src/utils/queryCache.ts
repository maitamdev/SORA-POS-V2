/**
 * In-memory client-side Query Cache (SWR-like) for API responses.
 * Avoids repeated network roundtrips when navigating between pages.
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

class ClientQueryCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Get cached data if not expired.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttlMs;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data with a time-to-live (TTL) in milliseconds.
   */
  set<T>(key: string, data: T, ttlMs = 60_000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
    });
  }

  /**
   * Invalidate entries matching a prefix key.
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached data.
   */
  clear(): void {
    this.cache.clear();
  }
}

export const queryCache = new ClientQueryCache();
