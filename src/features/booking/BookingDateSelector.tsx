"use client";

import { useState } from "react";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { BookingWindow } from "./BookingWindow";
import { addDays, firstOfMonth, type PublicDay } from "./calendar";

type Props = {
  days: PublicDay[];
  starts: string[];
  selected: string | null;
  today: string;
  timezone: string;
  onSelect: (day: string) => void;
};

export function BookingDateSelector({ days, starts, selected, today, timezone, onSelect }: Props) {
  const [month, setMonth] = useState<string | null>(null);
  if (!days.length || !starts.length) return <p role="status">Свободных окон пока нет.</p>;
  const lastDay = days[days.length - 1].day;
  const first = firstOfMonth(today);
  const last = firstOfMonth(lastDay);
  const anchor = month && month >= first && month <= last ? month : firstOfMonth(selected ?? starts[0]);
  const available = new Set(starts);

  return <section className="bk-buyer" aria-label="Выбор производственного окна">
    <p className="bk-zone">Часовой пояс мастерской · {timezone}</p>
    <AvailabilityCalendar anchor={anchor} today={today} selected={selected}
      range={selected ? { start: selected, end: addDays(selected, 1) } : undefined}
      min={today} max={lastDay} onNavigate={day => setMonth(firstOfMonth(day))}
      enabled={day => available.has(day)} onPick={onSelect}
      availability={day => available.has(day)
        ? { marker: "free", label: "Можно выбрать начало" }
        : { marker: "unavailable", label: "Начало недоступно" }}
      legend={{ free: "Свободное начало", unavailable: "Недоступно" }}/>
    <BookingWindow start={selected}/>
  </section>;
}
