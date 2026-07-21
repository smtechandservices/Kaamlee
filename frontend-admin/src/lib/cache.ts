// Simple in-memory response cache shared across admin pages (dashboard,
// companies, jobs) so bouncing between them doesn't refetch data that hasn't
// gone stale. Lives at module scope, so it persists across client-side route
// navigations within the same tab but resets on a full page reload — same
// tradeoff as the equivalent cache in the main frontend's explore page.
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes — matches the backend's own jobs cache TTL

interface CacheEntry {
  data: unknown;
  ts: number;
}

const _cache: Record<string, CacheEntry> = {};

export function getCached<T = unknown>(key: string): T | null {
  const entry = _cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}

export function setCache(key: string, data: unknown): void {
  _cache[key] = { data, ts: Date.now() };
}

// Call after any mutation (create/update/delete) so stale reads can't
// surface elsewhere — e.g. deleting a company should invalidate every
// cached companies page/filter, not just the one currently on screen.
export function invalidatePrefix(prefix: string): void {
  Object.keys(_cache).forEach((key) => {
    if (key.startsWith(prefix)) delete _cache[key];
  });
}
