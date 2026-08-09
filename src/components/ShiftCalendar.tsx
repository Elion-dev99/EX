"use client";

import { useMemo, useState } from "react";
import { addMonths, buildMonthGrid, formatMonthLabel } from "@/lib/calendar";
import type { MemberShifts, ShiftEntry } from "@/lib/types";

type DayShift = {
  memberId: string;
  memberName: string;
  color: string;
  shift: ShiftEntry;
};

type Props = {
  members: MemberShifts[];
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function ShiftCalendar({ members }: Props) {
  const now = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  }));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, DayShift[]>();
    for (const row of members) {
      if (!row.member.enabled || row.error === "無効") continue;
      for (const shift of row.shifts) {
        const list = map.get(shift.date) ?? [];
        list.push({
          memberId: row.member.id,
          memberName: row.scrapedName || row.member.name,
          color: row.member.color,
          shift,
        });
        map.set(shift.date, list);
      }
    }
    return map;
  }, [members]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.monthIndex, now),
    [cursor.monthIndex, cursor.year, now],
  );

  const selected = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  return (
    <section className="calendar-shell">
      <div className="calendar-toolbar">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setCursor((c) => addMonths(c.year, c.monthIndex, -1))}
        >
          前月
        </button>
        <h2>{formatMonthLabel(cursor.year, cursor.monthIndex)}</h2>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setCursor((c) => addMonths(c.year, c.monthIndex, 1))}
        >
          翌月
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() =>
            setCursor({ year: now.getFullYear(), monthIndex: now.getMonth() })
          }
        >
          今月
        </button>
      </div>

      <div className="weekday-row">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="month-grid">
        {cells.map((cell) => {
          const items = byDate.get(cell.date) ?? [];
          const working = items.filter((i) => !i.shift.isOff);
          const offs = items.filter((i) => i.shift.isOff);
          return (
            <button
              key={cell.date}
              type="button"
              className={[
                "day-cell",
                cell.inMonth ? "" : "out-month",
                cell.isToday ? "today" : "",
                selectedDate === cell.date ? "selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setSelectedDate(cell.date)}
            >
              <span className="day-num">{cell.day}</span>
              <div className="day-chips">
                {working.map((item) => (
                  <span
                    key={`${item.memberId}-${item.shift.date}`}
                    className="chip"
                    style={{ background: item.color }}
                    title={`${item.memberName} ${item.shift.label}`}
                  >
                    {item.memberName}
                  </span>
                ))}
                {working.length === 0 && offs.length > 0 && (
                  <span className="off-note">休み {offs.length}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="day-detail">
        <h3>{selectedDate ? `${selectedDate} のシフト` : "日付を選択"}</h3>
        {!selectedDate && <p className="muted">カレンダーの日付をタップすると詳細が出ます。</p>}
        {selectedDate && selected.length === 0 && (
          <p className="muted">この日の取得済みシフトはありません（サイト側の公開範囲外の可能性）。</p>
        )}
        {selected.length > 0 && (
          <ul>
            {selected.map((item) => (
              <li key={item.memberId}>
                <span className="swatch" style={{ background: item.color }} />
                <div>
                  <strong>{item.memberName}</strong>
                  <p>{item.shift.label}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
