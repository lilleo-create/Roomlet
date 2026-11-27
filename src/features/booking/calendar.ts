export type DayKey = string;

const DAY_MS = 86_400_000;
export const HORIZON_DAYS = 70;
export const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
const longDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
export function todayInStudio(now:Date, timeZone:string): DayKey {
  const workshopDate = new Intl.DateTimeFormat("en-CA", {year:"numeric",month:"2-digit",day:"2-digit",timeZone});
  const parts = workshopDate.formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function timeInZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone }).format(now);
}

export function validDate(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(key + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key;
}

function asDate(key: DayKey): Date {
  return new Date(key + "T12:00:00Z");
}
export function addDays(key: DayKey, offset: number): DayKey {
  return new Date(asDate(key).getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}
export function firstOfMonth(key: DayKey): DayKey {
  return key.slice(0, 7) + "-01";
}
export function moveMonth(key: DayKey, offset: number): DayKey {
  const date = asDate(firstOfMonth(key));
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}
export function dayOfWeek(key: DayKey): number {
  return (asDate(key).getUTCDay() + 6) % 7;
}
export function fullDay(key: DayKey): string { return longDate.format(asDate(key)); }
export function shortDay(key: DayKey): string { return shortDate.format(asDate(key)); }
export function monthTitle(key: DayKey): string { return monthName.format(asDate(key)); }
export function weekDates(key: DayKey): DayKey[] {
  const monday = addDays(key, -dayOfWeek(key));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}
export function monthDates(key: DayKey): DayKey[] {
  const start = weekDates(firstOfMonth(key))[0];
  const last = weekDates(addDays(moveMonth(key, 1), -1))[6];
  const count = Math.round((asDate(last).getTime() - asDate(start).getTime()) / DAY_MS) + 1;
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export type PublicDay = {day:string;available_minutes:number};
export function startsFromDays(days:readonly PublicDay[]): string[] {
  const open = new Set(days.filter(d=>validDate(d.day) && d.available_minutes>0).map(d=>d.day));
  return [...open].filter(d=>open.has(addDays(d,1))).sort();
}
export function windowLabel(start: DayKey): string {
  return `${shortDay(start)} — ${fullDay(addDays(start, 1))}`;
}
