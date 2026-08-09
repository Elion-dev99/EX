import * as cheerio from "cheerio";
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

export function buildShopShiftUrl(shopId: number): string {
  return `https://www.dgdgdg.com/boy/shift.php?shop_id=${shopId}`;
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
): ShopScheduleResult {
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
  return parseShopShiftHtml(html, shopId, now);
}
