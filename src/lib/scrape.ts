import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { buildBoyUrl } from "./members";
import type { Member, MemberShifts, ShiftEntry, ShiftStatus } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; EX-ShiftCalendar/1.0; +https://github.com/Elion-dev99/EX)";

const DATE_RE = /(\d{1,2})月(\d{1,2})日/;

function resolveYear(month: number, day: number, now = new Date()): number {
  const year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const diffDays = (candidate.getTime() - now.getTime()) / 86_400_000;

  if (diffDays > 300 && month >= 11 && now.getMonth() <= 1) return year - 1;
  if (diffDays < -40 && month <= 2 && now.getMonth() >= 10) return year + 1;
  return year;
}

function toIsoDate(month: number, day: number, now = new Date()): string {
  const year = resolveYear(month, day, now);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function buildLabel(parsed: Omit<ShiftEntry, "date" | "label">): string {
  if (parsed.status === "off") return parsed.statusText || "休";
  if (parsed.status === "inquiry") return parsed.statusText || "要問合せ";
  if (parsed.status === "other") return parsed.statusText || "その他";

  const range = [parsed.start, parsed.end].filter(Boolean).join("〜");
  if (parsed.night === true) return `${range} / NIGHT ○`;
  if (parsed.night === false) return `${range} / NIGHT ×`;
  return range || "出勤";
}

function parseShiftRow(
  $: cheerio.CheerioAPI,
  ul: AnyNode,
): Omit<ShiftEntry, "date" | "label"> {
  const items = $(ul)
    .children("li")
    .toArray()
    .map((li) => $(li).text().trim())
    .filter(Boolean);

  const joined = items.join(" ");
  if (items.some((item) => item.includes("休")) || $(ul).find("li.holiday").length > 0) {
    return {
      start: null,
      end: null,
      night: null,
      isOff: true,
      status: "off",
      statusText: "休",
    };
  }

  if (items.some((item) => item.includes("要問合せ")) || $(ul).find("li.single").length > 0) {
    const text = items.find((item) => item.includes("要問合せ")) || items[0] || "要問合せ";
    return {
      start: null,
      end: null,
      night: null,
      isOff: false,
      status: "inquiry",
      statusText: text,
    };
  }

  const times = items.filter((item) => /^\d{1,2}:\d{2}$/.test(item));
  let night: boolean | null = null;
  if (items.includes("○")) night = true;
  else if (items.includes("×")) night = false;

  if (times.length > 0) {
    return {
      start: times[0] ?? null,
      end: times[1] ?? null,
      night,
      isOff: false,
      status: "work",
      statusText: null,
    };
  }

  const other = items.find((item) => !["○", "×"].includes(item)) || joined || "不明";
  const status: ShiftStatus =
    other.includes("待機") || other.includes("自宅") ? "other" : "other";

  return {
    start: null,
    end: null,
    night: null,
    isOff: false,
    status,
    statusText: other,
  };
}

export function parseBoyDetailHtml(html: string, member: Member, now = new Date()): MemberShifts {
  const $ = cheerio.load(html);
  const sourceUrl = buildBoyUrl(member.shopId, member.boyId!);
  const scrapedName =
    $(".boy_name")
      .first()
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .trim() || null;
  const shopLabel = $("#shift_shop").text().replace(/[()]/g, "").trim() || null;

  const shifts: ShiftEntry[] = [];
  const dateNodes = $("#profile_shift .shift_date ul > li").toArray();
  const valueNodes = $("#profile_shift .shift_boy > ul")
    .toArray()
    .filter((ul) => $(ul).find("li.label").length === 0);

  const count = Math.min(dateNodes.length, valueNodes.length);
  for (let i = 0; i < count; i += 1) {
    const dateText = $(dateNodes[i]).text().trim();
    const match = dateText.match(DATE_RE);
    if (!match) continue;

    const month = Number(match[1]);
    const day = Number(match[2]);
    const parsed = parseShiftRow($, valueNodes[i]);
    const date = toIsoDate(month, day, now);

    shifts.push({
      date,
      ...parsed,
      label: buildLabel(parsed),
    });
  }

  return {
    member,
    scrapedName,
    shopLabel,
    sourceUrl,
    shifts,
  };
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

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return res.text();
}

export async function scrapeMemberShifts(member: Member, now = new Date()): Promise<MemberShifts> {
  if (!member.boyId) {
    return {
      member,
      scrapedName: null,
      shopLabel: null,
      sourceUrl: "",
      shifts: [],
      error: "boy_id が未設定です",
    };
  }

  const sourceUrl = buildBoyUrl(member.shopId, member.boyId);

  try {
    const html = await fetchHtml(sourceUrl);
    return parseBoyDetailHtml(html, member, now);
  } catch (error) {
    return {
      member,
      scrapedName: null,
      shopLabel: null,
      sourceUrl,
      shifts: [],
      error: error instanceof Error ? error.message : "スクレイピングに失敗しました",
    };
  }
}

export async function scrapeAllMembers(members: Member[], now = new Date()): Promise<MemberShifts[]> {
  const targets = members.filter((m) => m.enabled && m.boyId);
  const results = await Promise.all(targets.map((member) => scrapeMemberShifts(member, now)));

  const byId = new Map(results.map((r) => [r.member.id, r]));
  return members.map((member) => {
    if (byId.has(member.id)) return byId.get(member.id)!;
    return {
      member,
      scrapedName: null,
      shopLabel: null,
      sourceUrl: member.boyId ? buildBoyUrl(member.shopId, member.boyId) : "",
      shifts: [],
      error: member.enabled ? undefined : "無効",
    };
  });
}
