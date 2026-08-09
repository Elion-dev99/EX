import * as cheerio from "cheerio";
import { getCache, setCache } from "./cache";
import { colorFromBoyId } from "./colors";
import { buildBoyUrl } from "./members";

export type ShopDayBoy = {
  boyId: number;
  name: string;
  waitLabel: string | null; // 大阪店待機 / 神戸店待機 など
  timeText: string | null; // 13:00～LAST / 要問合せ
  status: "work" | "inquiry" | "other";
  label: string;
  sourceUrl: string;
  color: string;
};

export type ShopDaySchedule = {
  date: string; // YYYY-MM-DD
  dateLabel: string; // 8/9(日)
  boys: ShopDayBoy[];
};

export type ShopScheduleResult = {
  shopId: number;
  sourceUrl: string;
  affiliation: string;
  roster: Array<{
    boyId: number;
    name: string;
    color: string;
    sourceUrl: string;
  }>;
  days: ShopDaySchedule[];
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; EX-ShiftCalendar/1.0; +https://github.com/Elion-dev99/EX)";

/** shop_id → プロフィール「所属」に表示される店名 */
const SHOP_AFFILIATION: Record<number, string> = {
  2: "神戸店",
  4: "大阪店",
};

const AFFILIATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AFFILIATION_CONCURRENCY = 8;

export function buildShopShiftUrl(shopId: number): string {
  return `https://www.dgdgdg.com/boy/shift.php?shop_id=${shopId}`;
}

export function shopAffiliationLabel(shopId: number): string {
  return SHOP_AFFILIATION[shopId] || `shop_${shopId}`;
}

/** プロフィール詳細の所属（#Belongshop）を取り出す */
export function parseBelongShop(html: string): string | null {
  const $ = cheerio.load(html);
  const text = $("#Belongshop").first().text().replace(/\s+/g, " ").trim();
  if (text) return text;
  const m = html.match(/<div[^>]*id=["']Belongshop["'][^>]*>([^<]*)<\/div>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() || null;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i]);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

async function fetchBelongShop(shopId: number, boyId: number): Promise<string | null> {
  const cacheKey = `belongshop:${shopId}:${boyId}`;
  const cached = getCache<string | null>(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = buildBoyUrl(shopId, boyId);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en;q=0.8",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      setCache(cacheKey, null, 5 * 60 * 1000);
      return null;
    }
    const belong = parseBelongShop(await res.text());
    setCache(cacheKey, belong, AFFILIATION_CACHE_TTL_MS);
    return belong;
  } catch {
    setCache(cacheKey, null, 5 * 60 * 1000);
    return null;
  }
}

export async function filterByProfileAffiliation(
  schedule: Omit<ShopScheduleResult, "affiliation"> & { affiliation?: string },
  affiliation: string,
): Promise<ShopScheduleResult> {
  const allowed = new Set<number>();
  await mapPool(schedule.roster, AFFILIATION_CONCURRENCY, async (boy) => {
    const belong = await fetchBelongShop(schedule.shopId, boy.boyId);
    if (belong === affiliation) allowed.add(boy.boyId);
  });

  return {
    shopId: schedule.shopId,
    sourceUrl: schedule.sourceUrl,
    affiliation,
    roster: schedule.roster.filter((b) => allowed.has(b.boyId)),
    days: schedule.days.map((day) => ({
      ...day,
      boys: day.boys.filter((b) => allowed.has(b.boyId)),
    })),
  };
}

function resolveYear(month: number, day: number, now = new Date()): number {
  const year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const diffDays = (candidate.getTime() - now.getTime()) / 86_400_000;
  if (diffDays > 300 && month >= 11 && now.getMonth() <= 1) return year - 1;
  if (diffDays < -40 && month <= 2 && now.getMonth() >= 10) return year + 1;
  return year;
}

function parseDateLabel(label: string, now = new Date()): string | null {
  const m = label.match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = resolveYear(month, day, now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function classifyTime(timeText: string | null): {
  status: ShopDayBoy["status"];
  label: string;
} {
  if (!timeText) return { status: "other", label: "出勤" };
  if (timeText.includes("要問合せ")) return { status: "inquiry", label: timeText };
  return { status: "work", label: timeText };
}

function extractHonTenSectionHtml(dayHtml: string): string {
  const start = dayHtml.indexOf("当店在籍ボーイ");
  if (start < 0) return "";
  const rest = dayHtml.slice(start);
  const endMarkers = ["エリア内店在籍ボーイ", "<h2>", "<!-- ▲メイン"];
  let end = rest.length;
  for (const marker of endMarkers) {
    const idx = rest.indexOf(marker, 10);
    if (idx > 0 && idx < end) end = idx;
  }
  return rest.slice(0, end);
}

export function parseShopShiftHtml(
  html: string,
  shopId: number,
  now = new Date(),
): Omit<ShopScheduleResult, "affiliation"> {
  const sourceUrl = buildShopShiftUrl(shopId);
  const days: ShopDaySchedule[] = [];
  const rosterMap = new Map<
    number,
    { boyId: number; name: string; color: string; sourceUrl: string }
  >();

  const dayMatches = [...html.matchAll(/<h2><span>([^<]+)<\/span>の出勤ボーイ情報<\/h2>/g)];
  for (let i = 0; i < dayMatches.length; i += 1) {
    const match = dayMatches[i];
    const dateLabel = match[1].trim();
    const date = parseDateLabel(dateLabel, now);
    if (!date) continue;

    const from = match.index ?? 0;
    const to = i + 1 < dayMatches.length ? (dayMatches[i + 1].index ?? html.length) : html.length;
    const dayHtml = html.slice(from, to);
    const sectionHtml = extractHonTenSectionHtml(dayHtml);
    if (!sectionHtml) {
      days.push({ date, dateLabel, boys: [] });
      continue;
    }

    const $ = cheerio.load(sectionHtml);
    const boys: ShopDayBoy[] = [];
    const seen = new Set<number>();

    $("a[href*='boy_id=']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const idMatch = href.match(/boy_id=(\d{4,5})/);
      if (!idMatch) return;
      const boyId = Number(idMatch[1]);
      if (seen.has(boyId)) return;
      seen.add(boyId);

      const card = $(a);
      const name =
        card.find(".boy_data_name span").first().text().trim() ||
        card.find(".boy_data_name").first().text().trim() ||
        card.find("img[alt]").first().attr("alt")?.trim() ||
        `boy_${boyId}`;
      const waitLabel = card.find(".boy_shop").first().text().replace(/\s+/g, " ").trim() || null;
      const timeText = card.find(".time").first().text().replace(/\s+/g, " ").trim() || null;
      const { status, label: timeLabel } = classifyTime(timeText);
      const label = waitLabel ? `${waitLabel} / ${timeLabel}` : timeLabel;
      const color = colorFromBoyId(boyId);
      const url = buildBoyUrl(shopId, boyId);

      boys.push({
        boyId,
        name,
        waitLabel,
        timeText,
        status,
        label,
        sourceUrl: url,
        color,
      });

      const prev = rosterMap.get(boyId);
      if (!prev) {
        rosterMap.set(boyId, { boyId, name, color, sourceUrl: url });
      } else if (name && name !== `boy_${boyId}`) {
        prev.name = name;
      }
    });

    days.push({
      date,
      dateLabel,
      boys: boys.sort((a, b) => a.name.localeCompare(b.name, "ja")),
    });
  }

  return {
    shopId,
    sourceUrl,
    roster: [...rosterMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ja")),
    days,
  };
}

export async function scrapeShopSchedule(
  shopId: number,
  now = new Date(),
): Promise<ShopScheduleResult> {
  const url = buildShopShiftUrl(shopId);
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.8",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  const parsed = parseShopShiftHtml(html, shopId, now);
  const affiliation = shopAffiliationLabel(shopId);
  // シフト表の「当店在籍」には他店所属が混ざるため、プロフィール所属で絞る
  return filterByProfileAffiliation(parsed, affiliation);
}
