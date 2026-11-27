"use client";

import { useState } from "react";
import { DateRangePicker } from "@/features/booking/DateRangePicker";
import { todayInStudio } from "@/features/booking/calendar";
import { useClock } from "@/features/booking/useClock";
import type { DateRange } from "@/features/booking/selection";
import type { Block } from "./workshop";

export function BlockPeriodFields({ initialDay, initialToday, timezone, blocks }:
  { initialDay: string | null; initialToday: string; timezone: string; blocks: Block[] }) {
  const clock = useClock();
  const today = clock ? todayInStudio(clock.now, timezone) : initialToday;
  const [range, setRange] = useState<DateRange>({ start: initialDay, end: initialDay });
  return <>
    <DateRangePicker today={today} value={range} onChange={setRange} blocked={blocks} startName="start" endName="end"/>
    <label>Причина для мастера<input name="reason" maxLength={200}/></label>
    <button className="rs-primary" disabled={!range.start || !range.end}>Закрыть период</button>
  </>;
}
