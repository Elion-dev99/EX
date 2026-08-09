import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { buildBoyUrl } from "./members";
import type { Member, MemberShifts, ShiftEntry } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; EX-ShiftCalendar/1.0; +https://github.com/Elion-dev99/EX)";

const DATE_RE = /(\d{1,2})月(\d{1,2})日/;

function resolveYear(month: number, day: number, now = new Date()): number {
  const year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const diffDays = (candidate.getTime() - now.getTime()) / 86_400_000;

  // Near year boundary: Dec schedule in Jan → previous year
  if (diffDays > 300 && month >= 11 && now.getMonth() <= 1) return year - 1;
  // Near year boundary: Jan schedule in Dec → next year
  if (diffDays < -40 && month <= 2 && now.getMonth() >= 10) return year + 1;
  return year;
}

function toIsoDate(month: number, day: number, now = new Date()): string {
  const year = resolveYear(month, day, now);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseShiftRow($: cheerio.CheerioAPI, ul: AnyNode): Omit<ShiftEntry, "date" | "label"> {
  const items = $(ul)
    .children("li")
    .toArray()
    .map((li) => $(li).text().trim())
    .filter(Boolean);

  if (items.some((item) => item.includes("休")) || $(ul).find("li.holiday").length > 0) {
    return { start: null, end: null, night: false, isOff: true };
  }

  const times = items.filter((item) => /^\d{1,2}:\d{2}$/.test(item));
  const night = items.includes("○") || items.some((item) => /night/i.test(item) && item.includes("○"));

  return {
    start: times[0] ?? null,
    end: times[1] ?? null,
    night,
    isOff: times.length === 0,
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
    const label = parsed.isOff
      ? "休"
      : [parsed.start, parsed.end].filter(Boolean).join("〜") + (parsed.night ? " / NIGHT" : "");

    shifts.push({
      date,
      ...parsed,
      label,
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

  // Keep original order of all members, including disabled/empty slots as skipped
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
