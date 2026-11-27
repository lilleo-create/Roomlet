"use client";

import type { ComponentProps } from "react";
import { Calendar, type DayMarker } from "./CalendarGrid";

export type Availability = { marker: DayMarker; label: string };

type Props = Omit<ComponentProps<typeof Calendar>, "mark" | "describe"> & {
  availability: (day: string) => Availability;
  legend: Partial<Record<DayMarker, string>>;
};

export function AvailabilityCalendar({ availability, legend, ...props }: Props) {
  return <>
    <Calendar {...props} mark={day => availability(day).marker} describe={day => availability(day).label}/>
    <ul className="bk-legend" aria-label="Обозначения календаря">
      {Object.entries(legend).map(([marker, label]) => <li key={marker}><i data-mark={marker} aria-hidden/>{label}</li>)}
      <li><i data-mark="today" aria-hidden/>Сегодня</li>
    </ul>
  </>;
}
