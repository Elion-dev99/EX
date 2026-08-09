type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const globalForCache = globalThis as typeof globalThis & {
  __exCacheStore?: Map<string, CacheEntry<unknown>>;
};

function store(): Map<string, CacheEntry<unknown>> {
  if (!globalForCache.__exCacheStore) {
    globalForCache.__exCacheStore = new Map();
  }
  return globalForCache.__exCacheStore;
}

export function getCache<T>(key: string): CacheEntry<T> | null {
  const hit = store().get(key);
  if (!hit) return null;
  return hit as CacheEntry<T>;
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
  store().set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

export function clearCache(key?: string): void {
  if (!key) {
    store().clear();
    return;
  }
  store().delete(key);
}

// Back-compat helpers used by /api/shifts
import type { ShiftsResponse } from "./types";

export function getShiftsCache(): CacheEntry<ShiftsResponse> | null {
  return getCache<ShiftsResponse>("exec-shifts");
}

export function setShiftsCache(value: ShiftsResponse, ttlMs: number): void {
  setCache("exec-shifts", value, ttlMs);
}

export function clearShiftsCache(): void {
  clearCache("exec-shifts");
}
