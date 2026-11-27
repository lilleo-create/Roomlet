"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import { addDays, availableStarts, canStartWindow, firstOfMonth, HORIZON_DAYS, moveMonth, todayInStudio, windowLabel } from "./calendar";
import { useBlockedDates } from "./local-availability";
import { Calendar } from "./CalendarGrid";
import { BookingWindow } from "./BookingWindow";
import "@/styles/studio.css";

function onDateChange(fn: () => void) {
  const timer = window.setInterval(fn, 60000);
  window.addEventListener("focus", fn);
  return () => { window.clearInterval(timer); window.removeEventListener("focus", fn); };
}
export function BuyerBooking({onSelect}: {onSelect:(value:string|null)=>void}) {
  const today = useSyncExternalStore(onDateChange, todayInStudio, () => "");
  const blocks = useBlockedDates();
  const [chosen, setChosen] = useState<string | null>(null);
  const [browseMonth, setBrowseMonth] = useState<string | null>(null);
  const valid = !!today && !!chosen && canStartWindow(chosen, today, blocks);
  useEffect(() => { track("booking_calendar_view"); }, []);
  useEffect(() => {
    onSelect(valid && chosen ? windowLabel(chosen) : null);
    if (chosen && !valid) track("booking_unavailable");
  }, [chosen, valid, onSelect]);
  if (!today) return <div aria-busy="true" className="bk-window">Загрузка календаря…</div>;
  const starts = availableStarts(today, blocks);
  const anchor = browseMonth ?? firstOfMonth(starts[0] ?? today);
  const last = firstOfMonth(addDays(today, HORIZON_DAYS));
  const canMove = (offset: number) => {
    const target = moveMonth(anchor, offset);
    return target >= firstOfMonth(today) && target <= last;
  };
  function pick(day: string) {
    if (!canStartWindow(day, today, blocks)) return;
    setChosen(day);
    track("booking_window_select", {start: day});
  }
  return <section className="bk-buyer" aria-label="Выбор производственного окна">
    <Calendar anchor={anchor} selected={valid ? chosen : null} today={today} onPick={pick}
      onMove={(step) => setBrowseMonth(moveMonth(anchor, step))} canMove={canMove}
      enabled={(day) => canStartWindow(day, today, blocks)}
      describe={(day) => canStartWindow(day, today, blocks) ? "Можно выбрать начало" : "Недоступно"}/>
    {starts.length > 0 ? <BookingWindow start={valid ? chosen : null}/> : <p role="status">На ближайшие 70 дней свободных окон нет.</p>}
  </section>;
}
