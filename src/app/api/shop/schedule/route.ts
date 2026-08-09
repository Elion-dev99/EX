import { NextResponse } from "next/server";
import { clearCache, getCache, setCache } from "@/lib/cache";
import { scrapeShopSchedule, type ShopScheduleResult } from "@/lib/shop-schedule";

const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shopId = Number(searchParams.get("shop_id") || "4");
  const force = searchParams.get("refresh") === "1";

  if (!Number.isInteger(shopId) || shopId <= 0) {
    return NextResponse.json({ error: "shop_id が不正です" }, { status: 400 });
  }

  const cacheKey = `shop-schedule:${shopId}`;
  if (!force) {
    const cached = getCache<{ fetchedAt: string; data: ShopScheduleResult }>(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({
        fetchedAt: cached.value.fetchedAt,
        cached: true,
        ...cached.value.data,
      });
    }
  } else {
    clearCache(cacheKey);
  }

  try {
    const data = await scrapeShopSchedule(shopId);
    const fetchedAt = new Date().toISOString();
    setCache(cacheKey, { fetchedAt, data }, CACHE_TTL_MS);
    return NextResponse.json({ fetchedAt, cached: false, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "スケジュール取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
