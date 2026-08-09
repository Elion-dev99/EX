"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ShopCalendar } from "@/components/ShopCalendar";
import type { ShopDayBoy, ShopScheduleResult } from "@/lib/shop-schedule";

type Filter = "all" | "work" | "inquiry" | "off" | "osaka" | "other-shop";

type Props = {
  shopId: number;
};

type ScheduleResponse = ShopScheduleResult & {
  fetchedAt: string;
  cached: boolean;
  error?: string;
};

type DayRow = {
  boyId: number;
  name: string;
  color: string;
  sourceUrl: string;
  entry: ShopDayBoy | null;
};

function toDateLabel(date: string, fallback?: string): string {
  if (fallback) return fallback;
  const d = new Date(`${date}T12:00:00`);
  const week = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${week})`;
}

export function ShopShiftBoard({ shopId }: Props) {
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(
    (refresh = false) => {
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch(
            `/api/shop/schedule?shop_id=${shopId}${refresh ? "&refresh=1" : ""}`,
            { cache: "no-store" },
          );
          const json = (await res.json()) as ScheduleResponse;
          if (!res.ok) throw new Error(json.error || "取得に失敗しました");
          setData(json);
          setSelectedDate((prev) => {
            if (prev && json.days.some((d) => d.date === prev)) return prev;
            const today = new Date();
            const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            if (json.days.some((d) => d.date === key)) return key;
            return json.days[0]?.date || "";
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : "取得に失敗しました");
        }
      });
    },
    [shopId],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const selectedDay = useMemo(
    () => data?.days.find((d) => d.date === selectedDate) || null,
    [data, selectedDate],
  );

  const rows: DayRow[] = useMemo(() => {
    if (!data) return [];
    const byId = new Map((selectedDay?.boys || []).map((b) => [b.boyId, b]));
    const q = query.trim();

    return data.roster
      .map((boy) => ({
        boyId: boy.boyId,
        name: boy.name,
        color: boy.color,
        sourceUrl: boy.sourceUrl,
        entry: byId.get(boy.boyId) || null,
      }))
      .filter((row) => {
        if (q && !row.name.includes(q)) return false;
        if (filter === "all") return true;
        if (filter === "off") return !row.entry;
        if (!row.entry) return false;
        if (filter === "work") return row.entry.status === "work";
        if (filter === "inquiry") return row.entry.status === "inquiry";
        if (filter === "osaka") return Boolean(row.entry.waitLabel?.includes("大阪"));
        if (filter === "other-shop") {
          return Boolean(row.entry.waitLabel && !row.entry.waitLabel.includes("大阪"));
        }
        return true;
      })
      .sort((a, b) => {
        const rank = (row: DayRow) => {
          if (!row.entry) return 5;
          if (row.entry.status === "work") return 0;
          if (row.entry.status === "inquiry") return 1;
          if (row.entry.waitLabel?.includes("大阪")) return 2;
          return 3;
        };
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name, "ja");
      });
  }, [data, filter, query, selectedDay]);

  const counts = useMemo(() => {
    if (!data) return { all: 0, work: 0, inquiry: 0, off: 0, osaka: 0, otherShop: 0 };
    const byId = new Map((selectedDay?.boys || []).map((b) => [b.boyId, b]));
    let work = 0;
    let inquiry = 0;
    let off = 0;
    let osaka = 0;
    let otherShop = 0;
    for (const boy of data.roster) {
      const entry = byId.get(boy.boyId);
      if (!entry) {
        off += 1;
        continue;
      }
      if (entry.status === "work") work += 1;
      if (entry.status === "inquiry") inquiry += 1;
      if (entry.waitLabel?.includes("大阪")) osaka += 1;
      else if (entry.waitLabel) otherShop += 1;
    }
    return { all: data.roster.length, work, inquiry, off, osaka, otherShop };
  }, [data, selectedDay]);

  return (
    <div className="board shop-board">
      <header className="hero shop-hero">
        <div className="hero-copy">
          <p className="brand">EX Shift</p>
          <h1>大阪店 全員シフト</h1>
          <p className="lede">
            当店在籍 {data?.roster.length ?? "—"}人をカレンダー表示。日付を選ぶと待機店舗・時間・休みまで全員分確認できます。
          </p>
          <div className="cta-row">
            <button type="button" className="primary-btn" onClick={() => load(true)} disabled={pending}>
              {pending ? "取得中…" : "最新を取得"}
            </button>
            {data?.sourceUrl && (
              <a className="ghost-btn" href={data.sourceUrl} target="_blank" rel="noreferrer">
                元ページ
              </a>
            )}
          </div>
          <p className="meta">
            {data
              ? `最終取得: ${new Date(data.fetchedAt).toLocaleString("ja-JP")}${
                  data.cached ? "（キャッシュ）" : ""
                } / ${data.roster.length}人`
              : "未取得"}
          </p>
        </div>
      </header>

      {error && <p className="error banner">{error}</p>}

      {data && (
        <ShopCalendar
          days={data.days}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}

      <section className="shop-toolbar">
        <div className="filter-row">
          {(
            [
              ["all", `全員 ${counts.all}`],
              ["work", `時間あり ${counts.work}`],
              ["inquiry", `要問合せ ${counts.inquiry}`],
              ["osaka", `大阪店待機 ${counts.osaka}`],
              ["other-shop", `他店待機 ${counts.otherShop}`],
              ["off", `休み/未掲載 ${counts.off}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? "filter-chip active" : "filter-chip"}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search-box">
          名前検索
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例: つむぎ" />
        </label>
      </section>

      <section className="shop-list">
        <h2>
          {selectedDay
            ? `${toDateLabel(selectedDay.date, selectedDay.dateLabel)} の一覧`
            : selectedDate
              ? `${toDateLabel(selectedDate)} の一覧`
              : "日付を選択"}
          <span className="muted"> {rows.length}人</span>
        </h2>
        <ul>
          {rows.map((row) => (
            <li key={row.boyId}>
              <span className="swatch" style={{ background: row.color }} />
              <div className="shop-row-main">
                <strong>{row.name}</strong>
                <p>{row.entry ? row.entry.label : "休み / この日の公開シフトなし"}</p>
              </div>
              <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                詳細
              </a>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="muted">該当するボーイがいません。フィルタや検索を変えてみてください。</li>
          )}
        </ul>
      </section>
    </div>
  );
}
