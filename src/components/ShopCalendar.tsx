"use client";

import { useMemo, useState } from "react";
import { addMonths, buildMonthGrid, formatMonthLabel } from "@/lib/calendar";
import type { ShopDaySchedule } from "@/lib/shop-schedule";

type Props = {
  days: ShopDaySchedule[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function monthFromDate(date: string | undefined, fallback: Date) {
  if (!date) return { year: fallback.getFullYear(), monthIndex: fallback.getMonth() };
  const [y, m] = date.split("-").map(Number);
  return { year: y, monthIndex: m - 1 };
}

export function ShopCalendar({ days, selectedDate, onSelectDate }: Props) {
  const now = useMemo(() => new Date(), []);
  const available = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const [cursor, setCursor] = useState(() =>
    monthFromDate(selectedDate || days[0]?.date, now),
  );
  const [trackedSelected, setTrackedSelected] = useState(selectedDate);

  if (selectedDate !== trackedSelected) {
    setTrackedSelected(selectedDate);
    if (selectedDate) {
      const next = monthFromDate(selectedDate, now);
      if (next.year !== cursor.year || next.monthIndex !== cursor.monthIndex) {
        setCursor(next);
      }
    }
  }

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.monthIndex, now),
    [cursor.monthIndex, cursor.year, now],
  );

  return (
    <section className="calendar-shell shop-calendar">
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
          onClick={() => setCursor({ year: now.getFullYear(), monthIndex: now.getMonth() })}
        >
          今月
        </button>
      </div>

      <div className="weekday-row">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="month-grid shop-month-grid">
        {cells.map((cell) => {
          const day = available.get(cell.date);
          const boys = day?.boys ?? [];
          const hasData = Boolean(day);
          return (
            <button
              key={cell.date}
              type="button"
              className={[
                "day-cell",
                "shop-day-cell",
                cell.inMonth ? "" : "out-month",
                cell.isToday ? "today" : "",
                selectedDate === cell.date ? "selected" : "",
                hasData ? "has-data" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDate(cell.date)}
            >
              <span className="day-num">
                {cell.day}
                {hasData && <em>{boys.length}</em>}
              </span>
              <div className="day-chips">
                {boys.map((boy) => (
                  <span
                    key={`${cell.date}-${boy.boyId}`}
                    className={`chip ${boy.status === "inquiry" ? "chip-inquiry" : ""}`}
                    style={{ background: boy.color }}
                    title={`${boy.name} ${boy.label}`}
                  >
                    {boy.name}
                  </span>
                ))}
                {!hasData && cell.inMonth && <span className="off-note">データなし</span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
