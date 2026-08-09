export type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
};

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

export function addMonths(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

export function buildMonthGrid(year: number, monthIndex: number, today = new Date()): CalendarCell[] {
  const first = startOfMonth(year, monthIndex);
  const startWeekday = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();
  const todayKey = toDateKey(today);

  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i += 1) {
    const dayOffset = i - startWeekday;
    let y = year;
    let m = monthIndex;
    let day: number;
    let inMonth = true;

    if (dayOffset < 0) {
      inMonth = false;
      m = monthIndex - 1;
      day = prevMonthDays + dayOffset + 1;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
    } else if (dayOffset >= daysInMonth) {
      inMonth = false;
      m = monthIndex + 1;
      day = dayOffset - daysInMonth + 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    } else {
      day = dayOffset + 1;
    }

    const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      date,
      day,
      inMonth,
      isToday: date === todayKey,
    });
  }

  return cells;
}

export function formatMonthLabel(year: number, monthIndex: number): string {
  return `${year}年${monthIndex + 1}月`;
}
