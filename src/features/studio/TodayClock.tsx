"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { fullDay, shortDay, timeInZone, todayInStudio } from "@/features/booking/calendar";
import { useClock } from "@/features/booking/useClock";

export function TodayClock({ workshopZone }: { workshopZone: string }) {
  const clock = useClock();
  const day = clock && todayInStudio(clock.now, clock.timeZone);
  return <section className="rs-date-poster">
    <p className="rs-cap">Местное время{clock && ` · ${clock.timeZone}`}</p>
    <span className="rs-poster-day">{day ? Number(day.slice(-2)) : "—"}</span>
    <div>{clock && day && <>
      <strong>{shortDay(day).replace(/^\d+\s+/u, "")}</strong>
      <time dateTime={clock.now.toISOString()}>{day.slice(0, 4)} · {timeInZone(clock.now, clock.timeZone)}</time>
    </>}</div>
    {clock && clock.timeZone !== workshopZone && <p className="rs-workshop-time">
      В мастерской · {fullDay(todayInStudio(clock.now, workshopZone))}, {timeInZone(clock.now, workshopZone)} ({workshopZone})
    </p>}
    <Link href="/studio/calendar"><CalendarDays size={18}/> Календарь <ArrowUpRight size={18}/></Link>
  </section>;
}
