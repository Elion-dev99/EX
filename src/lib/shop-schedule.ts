import * as cheerio from "cheerio";
import { colorFromBoyId } from "./colors";
import { buildBoyUrl } from "./members";

export type ShopRosterBoy = {
  boyId: number;
  name: string;
  color: string;
  sourceUrl: string;
};

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
  shiftSourceUrl: string;
  affiliation: string;
  roster: ShopRosterBoy[];
  days: ShopDaySchedule[];
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; EX-ShiftCalendar/1.0; +https://github.com/Elion-dev99/EX)";

/** shop_id → 表示用の店名 */
const SHOP_AFFILIATION: Record<number, string> = {
  2: "神戸店",
  4: "大阪店",
};

export function buildShopShiftUrl(shopId: number): string {
  return `https://www.dgdgdg.com/boy/shift.php?shop_id=${shopId}`;
}

export function buildShopBoyListUrl(shopId: number): string {
  return `https://www.dgdgdg.com/boy/list.php?shop_id=${shopId}`;
}

export function shopAffiliationLabel(shopId: number): string {
  return SHOP_AFFILIATION[shopId] || `shop_${shopId}`;
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

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.8",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * ボーイ一覧の本店グリッド（title_boylist_taiki / h2=taiki）を正規ロスターにする。
 * W在籍・呼び出し等は含めない。
 */
export function parseShopRosterHtml(html: string, shopId: number): ShopRosterBoy[] {
  const sections = html.split(/<h2[\s>]/i);
  let sectionHtml = "";
  for (const part of sections) {
    const head = part.slice(0, 500);
    if (/title_boylist_taiki/i.test(head) || />\s*taiki\s*</i.test(head)) {
      sectionHtml = part;
      break;
    }
  }
  if (!sectionHtml) {
    throw new Error("ボーイ一覧の本店セクション（taiki）が見つかりません");
  }

  const $ = cheerio.load(sectionHtml);
  const roster: ShopRosterBoy[] = [];
  const seen = new Set<number>();

  $("a[href*='boy_id=']").each((_, a) => {
    const href = $(a).attr("href") || "";
    const idMatch = href.match(/boy_id=(\d{3,6})/);
    if (!idMatch) return;
    const boyId = Number(idMatch[1]);
    if (seen.has(boyId)) return;
    seen.add(boyId);

    const name =
      $(a).find(".boy_name").first().text().replace(/\s+/g, " ").trim() ||
      $(a).closest("li, div, td").find(".boy_name").first().text().replace(/\s+/g, " ").trim() ||
      $(a).find("img[alt]").first().attr("alt")?.replace(/\s+/g, " ").trim() ||
      `boy_${boyId}`;

    roster.push({
      boyId,
      name,
      color: colorFromBoyId(boyId),
      sourceUrl: buildBoyUrl(shopId, boyId),
    });
  });

  if (roster.length === 0) {
    throw new Error("ボーイ一覧から在籍ボーイを取得できませんでした");
  }
  return roster;
}

function extractDayBoysHtml(dayHtml: string): string {
  // 当店在籍 + エリア内の両方を見る（ロスターで後から絞る）
  const startMarkers = ["当店在籍ボーイ", "エリア内店在籍ボーイ", "出勤ボーイ"];
  let start = -1;
  for (const marker of startMarkers) {
    const idx = dayHtml.indexOf(marker);
    if (idx >= 0 && (start < 0 || idx < start)) start = idx;
  }
  if (start < 0) return dayHtml;
  return dayHtml.slice(start);
}

export function parseShopShiftDays(
  html: string,
  shopId: number,
  allowedBoyIds: Set<number> | null = null,
  now = new Date(),
): ShopDaySchedule[] {
  const days: ShopDaySchedule[] = [];
  const dayMatches = [...html.matchAll(/<h2><span>([^<]+)<\/span>の出勤ボーイ情報<\/h2>/g)];

  for (let i = 0; i < dayMatches.length; i += 1) {
    const match = dayMatches[i];
    const dateLabel = match[1].trim();
    const date = parseDateLabel(dateLabel, now);
    if (!date) continue;

    const from = match.index ?? 0;
    const to = i + 1 < dayMatches.length ? (dayMatches[i + 1].index ?? html.length) : html.length;
    const dayHtml = extractDayBoysHtml(html.slice(from, to));
    const $ = cheerio.load(dayHtml);
    const boys: ShopDayBoy[] = [];
    const seen = new Set<number>();

    $("a[href*='boy_id=']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const idMatch = href.match(/boy_id=(\d{3,6})/);
      if (!idMatch) return;
      const boyId = Number(idMatch[1]);
      if (seen.has(boyId)) return;
      if (allowedBoyIds && !allowedBoyIds.has(boyId)) return;
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

      boys.push({
        boyId,
        name,
        waitLabel,
        timeText,
        status,
        label,
        sourceUrl: buildBoyUrl(shopId, boyId),
        color: colorFromBoyId(boyId),
      });
    });

    days.push({
      date,
      dateLabel,
      boys: boys.sort((a, b) => a.name.localeCompare(b.name, "ja")),
    });
  }

  return days;
}

/** @deprecated kept for tests / callers that only have shift HTML */
export function parseShopShiftHtml(
  html: string,
  shopId: number,
  now = new Date(),
): Omit<ShopScheduleResult, "affiliation" | "shiftSourceUrl"> {
  const days = parseShopShiftDays(html, shopId, null, now);
  const rosterMap = new Map<number, ShopRosterBoy>();
  for (const day of days) {
    for (const boy of day.boys) {
      if (!rosterMap.has(boy.boyId)) {
        rosterMap.set(boy.boyId, {
          boyId: boy.boyId,
          name: boy.name,
          color: boy.color,
          sourceUrl: boy.sourceUrl,
        });
      }
    }
  }
  return {
    shopId,
    sourceUrl: buildShopShiftUrl(shopId),
    roster: [...rosterMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ja")),
    days,
  };
}

export async function scrapeShopSchedule(
  shopId: number,
  now = new Date(),
): Promise<ShopScheduleResult> {
  const listUrl = buildShopBoyListUrl(shopId);
  const shiftUrl = buildShopShiftUrl(shopId);
  const [listHtml, shiftHtml] = await Promise.all([fetchHtml(listUrl), fetchHtml(shiftUrl)]);

  const roster = parseShopRosterHtml(listHtml, shopId);
  const allowed = new Set(roster.map((b) => b.boyId));
  const days = parseShopShiftDays(shiftHtml, shopId, allowed, now);

  // シフトに出ている名前の方が新しい場合はロスター名を更新
  const nameById = new Map<number, string>();
  for (const day of days) {
    for (const boy of day.boys) {
      if (boy.name && !boy.name.startsWith("boy_")) nameById.set(boy.boyId, boy.name);
    }
  }
  const mergedRoster = roster.map((boy) => ({
    ...boy,
    name: nameById.get(boy.boyId) || boy.name,
  }));

  return {
    shopId,
    sourceUrl: listUrl,
    shiftSourceUrl: shiftUrl,
    affiliation: shopAffiliationLabel(shopId),
    roster: mergedRoster,
    days,
  };
}
