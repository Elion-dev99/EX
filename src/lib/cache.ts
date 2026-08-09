import type { ShiftsResponse } from "./types";

type CacheEntry = {
  expiresAt: number;
  value: ShiftsResponse;
};

const globalForCache = globalThis as typeof globalThis & {
  __exShiftCache?: CacheEntry | null;
};

export function getShiftsCache(): CacheEntry | null {
  return globalForCache.__exShiftCache ?? null;
}

export function setShiftsCache(value: ShiftsResponse, ttlMs: number): void {
  globalForCache.__exShiftCache = {
    expiresAt: Date.now() + ttlMs,
    value,
  };
}

export function clearShiftsCache(): void {
  globalForCache.__exShiftCache = null;
}
