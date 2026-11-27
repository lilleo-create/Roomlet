"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { BookingDateSelector } from "./BookingDateSelector";
import { addDays, startsFromDays, todayInStudio, windowLabel, type PublicDay } from "./calendar";
import { useClock } from "./useClock";

type Schedule = { days: PublicDay[]; timezone: string };

export function BuyerBooking({ onSelect }: { onSelect: (value: string | null) => void }) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const clock = useClock();
  const workshopDay = clock && schedule ? todayInStudio(clock.now, schedule.timezone) : null;
  const previousDay = useRef<string | null>(null);
  const refresh = useCallback(() => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    void fetch("/api/availability", { cache: "no-store", signal: request.signal })
      .then(response => {
        if (!response.ok) throw new Error("Расписание недоступно");
        return response.json() as Promise<Schedule>;
      })
      .then(data => {
        if (!request.signal.aborted) { setSchedule(data); setFailed(false); }
      })
      .catch(() => {
        if (!request.signal.aborted) { setFailed(true); setSchedule(null); }
      });
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { controller.current?.abort(); window.removeEventListener("focus", refresh); };
  }, [refresh]);
  useEffect(() => {
    if (workshopDay && previousDay.current && previousDay.current !== workshopDay) void refresh();
    previousDay.current = workshopDay;
  }, [workshopDay, refresh]);
  useEffect(() => { track("booking_calendar_view"); }, []);

  const starts = startsFromDays(schedule?.days ?? []).filter(day => !workshopDay || day > workshopDay);
  const selected = chosen && starts.includes(chosen) ? chosen : null;
  useEffect(() => { onSelect(selected ? windowLabel(selected) : null); }, [selected, onSelect]);
  if (failed) return <p role="status">Расписание недоступно. <button type="button" onClick={refresh}>Повторить</button></p>;
  if (!schedule) return <p aria-busy="true">Загрузка календаря…</p>;
  if (!schedule.days.length) return <p role="status">Свободных окон пока нет.</p>;
  return <BookingDateSelector days={schedule.days} starts={starts} selected={selected} timezone={schedule.timezone}
    today={workshopDay ?? addDays(schedule.days[0].day, -1)} onSelect={day => {
      setChosen(day);
      track("booking_window_select", { start: day });
    }}/>;
}
