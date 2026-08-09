"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { MemberSettings } from "@/components/MemberSettings";
import { ShiftCalendar } from "@/components/ShiftCalendar";
import type { Member, MemberShifts, ShiftsResponse } from "@/lib/types";

type Props = {
  initialMembers: Member[];
};

export function ShiftBoard({ initialMembers }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [shifts, setShifts] = useState<MemberShifts[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadShifts = useCallback((refresh = false) => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/shifts${refresh ? "?refresh=1" : ""}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("シフト取得に失敗しました");
        const data = (await res.json()) as ShiftsResponse;
        setShifts(data.members);
        setFetchedAt(data.fetchedAt);
        setCached(data.cached);
      } catch (e) {
        setError(e instanceof Error ? e.message : "シフト取得に失敗しました");
      }
    });
  }, []);

  useEffect(() => {
    loadShifts(false);
  }, [loadShifts]);

  const active = shifts.filter((s) => s.member.enabled && s.member.boyId);
  const scrapeErrors = active.filter((s) => s.error && s.error !== "無効");

  return (
    <div className="board">
      <header className="hero">
        <div className="hero-copy">
          <p className="brand">EX Shift</p>
          <h1>幹部シフトカレンダー</h1>
          <p className="lede">
            dgdgdg の出勤スケジュールをまとめて把握。6人分の公開シフトを横断表示します。
          </p>
          <div className="cta-row">
            <button
              type="button"
              className="primary-btn"
              onClick={() => loadShifts(true)}
              disabled={pending}
            >
              {pending ? "取得中…" : "最新を取得"}
            </button>
            <MemberSettings
              members={members}
              onSaved={(next) => {
                setMembers(next);
                loadShifts(true);
              }}
            />
          </div>
          <p className="meta">
            {fetchedAt
              ? `最終取得: ${new Date(fetchedAt).toLocaleString("ja-JP")}${cached ? "（キャッシュ）" : ""}`
              : "未取得"}
          </p>
        </div>
      </header>

      <section className="legend">
        {members.map((m) => (
          <div key={m.id} className={`legend-item ${m.enabled && m.boyId ? "" : "dim"}`}>
            <span className="swatch" style={{ background: m.color }} />
            <span>{m.name}</span>
            {!m.boyId && <em>未設定</em>}
            {m.boyId && !m.enabled && <em>非表示</em>}
          </div>
        ))}
      </section>

      {error && <p className="error banner">{error}</p>}
      {scrapeErrors.length > 0 && (
        <div className="error banner">
          {scrapeErrors.map((s) => (
            <p key={s.member.id}>
              {s.member.name}: {s.error}
            </p>
          ))}
        </div>
      )}

      <ShiftCalendar members={shifts} />

      <section className="source-list">
        <h2>取得ソース</h2>
        <ul>
          {active.map((row) => (
            <li key={row.member.id}>
              <span className="swatch" style={{ background: row.member.color }} />
              <div>
                <strong>{row.scrapedName || row.member.name}</strong>
                <p>{row.shopLabel ?? "店舗情報なし"} / {row.shifts.length}件</p>
                {row.sourceUrl && (
                  <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                    元ページを開く
                  </a>
                )}
              </div>
            </li>
          ))}
          {active.length === 0 && <li className="muted">有効なメンバーがありません。設定からURLを登録してください。</li>}
        </ul>
      </section>
    </div>
  );
}
