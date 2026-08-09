import { NextResponse } from "next/server";
import { clearShiftsCache, getShiftsCache, setShiftsCache } from "@/lib/cache";
import { readMembers } from "@/lib/members";
import { scrapeAllMembers } from "@/lib/scrape";
import type { ShiftsResponse } from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "1";

  if (!force) {
    const cached = getShiftsCache();
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ ...cached.value, cached: true });
    }
  } else {
    clearShiftsCache();
  }

  const members = await readMembers();
  const scraped = await scrapeAllMembers(members);
  const payload: ShiftsResponse = {
    fetchedAt: new Date().toISOString(),
    cached: false,
    members: scraped,
  };

  setShiftsCache(payload, CACHE_TTL_MS);
  return NextResponse.json(payload);
}
