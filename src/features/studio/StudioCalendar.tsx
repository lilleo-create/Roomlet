"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState, PageHeading } from "@/components/ui";
import { AvailabilityCalendar, type Availability } from "../booking/AvailabilityCalendar";
import { dayOfWeek, fullDay, todayInStudio } from "../booking/calendar";
import { useClock } from "../booking/useClock";
import type { Workshop } from "./workshop";

export function StudioCalendar({ today: initialToday, workshop }: { today: string; workshop: Workshop }) {
  const clock = useClock();
  const today = clock ? todayInStudio(clock.now, workshop.timezone) : initialToday;
  const [selection, setSelection] = useState<string | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [mode, setMode] = useState<"week" | "month">("month");
  const day = selection ?? today;
  const blocks = workshop.blocks.filter(block => day >= block.start_date && day <= block.end_date);
  const settings = <Link className="rs-block" href={"/studio/settings?day=" + day}>Управлять периодом</Link>;

  function availability(date: string): Availability {
    if (workshop.blocks.some(b => date >= b.start_date && date <= b.end_date)) return { marker: "blocked", label: "Заблокировано" };
    const minutes = workshop.hours.find(h => h.weekday === dayOfWeek(date) + 1)?.minutes ?? 0;
    if (!minutes) return { marker: "unavailable", label: "Выходной" };
    const free = Math.max(0, minutes - workshop.bufferMinutes);
    return free ? { marker: "free", label: free + " мин свободно по графику" }
      : { marker: "unavailable", label: "Свободного времени нет" };
  }

  return <>
    <PageHeading title="Календарь" action={<div className="rs-switch" role="group" aria-label="Вид календаря">
      {(["month", "week"] as const).map(item => <button type="button" key={item} aria-pressed={mode === item}
        onClick={() => setMode(item)}>{item === "month" ? "Месяц" : "Неделя"}</button>)}
    </div>}/>
    <div className="rs-cal-layout">
      <section className="rs-cal-main" aria-label="График мастерской">
        <AvailabilityCalendar anchor={view ?? day} selected={day} today={today} mode={mode}
          onPick={date => { setSelection(date === today ? null : date); setView(null); }} onNavigate={setView}
          availability={availability} legend={{ free: "Свободно", unavailable: "Нет времени", blocked: "Блокировка" }}/>
        <button type="button" className="bk-clear" onClick={() => { setView(null); setSelection(null); }}>К сегодняшнему дню</button>
      </section>
      <section className="rs-selected" aria-live="polite"><p className="rs-cap">{workshop.timezone}</p><h2>{fullDay(day)}</h2>
        {blocks.length ? <><p>{availability(day).label}</p>{blocks.map(b => b.reason && <p key={b.id}>{b.reason}</p>)}{settings}</>
          : <EmptyState variant="calendar" heading="h3" title="На этот день ничего не запланировано" description={availability(day).label} action={settings}/>}
      </section>
    </div>
  </>;
}
