import { addDays, dayOfWeek, moveMonth, type DayKey } from "./calendar.ts";

export type DateRange = { start: DayKey | null; end: DayKey | null };

export function selectRange(range: DateRange, day: DayKey): DateRange {
  if (!range.start || range.end) return { start: day, end: null };
  return day < range.start ? { start: day, end: range.start } : { start: range.start, end: day };
}

export function calendarKeyTarget(day: DayKey, key: string): DayKey | undefined {
  switch (key) {
    case "ArrowLeft": return addDays(day, -1);
    case "ArrowRight": return addDays(day, 1);
    case "ArrowUp": return addDays(day, -7);
    case "ArrowDown": return addDays(day, 7);
    case "Home": return addDays(day, -dayOfWeek(day));
    case "End": return addDays(day, 6 - dayOfWeek(day));
    case "PageUp":
    case "PageDown": {
      const first = moveMonth(day, key === "PageUp" ? -1 : 1);
      const last = addDays(moveMonth(first, 1), -1);
      return first.slice(0, 8) + (day.slice(8) < last.slice(8) ? day.slice(8) : last.slice(8));
    }
  }
}
