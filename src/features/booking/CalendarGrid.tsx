"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui";
import { dayOfWeek, fullDay, monthDates, monthTitle, shortDay, weekdays, weekDates, type DayKey } from "./calendar";

type Props = {
  anchor: DayKey;
  selected: DayKey | null;
  today: DayKey;
  mode?: "month" | "week";
  onPick: (day: DayKey) => void;
  onMove: (offset: number) => void;
  canMove: (offset: number) => boolean;
  describe: (day: DayKey) => string;
  enabled: (day: DayKey) => boolean;
  mark?: (day: DayKey) => string;
};
export function Calendar({anchor, selected, today, mode = "month", onPick, onMove, canMove, describe, enabled, mark}: Props) {
  const days = mode === "month" ? monthDates(anchor) : weekDates(anchor);
  const caption = mode === "month" ? monthTitle(anchor) : `${shortDay(days[0])} — ${shortDay(days[6])}`;
  return <div className="bk-calendar">
    <div className="bk-calendar-heading">
      <strong aria-live="polite">{caption}</strong>
      <div className="bk-month-arrows">
        <IconButton label="Предыдущий период" disabled={!canMove(-1)} onClick={() => onMove(-1)}><ChevronLeft size={18}/></IconButton>
        <IconButton label="Следующий период" disabled={!canMove(1)} onClick={() => onMove(1)}><ChevronRight size={18}/></IconButton>
      </div>
    </div>
    <div className="bk-grid" role="group" aria-label={caption}>
      {weekdays.map((d) => <span className="bk-weekday" key={d} aria-hidden="true">{d}</span>)}
      {days.map((day) => {
        const outside = mode === "month" && day.slice(0, 7) !== anchor.slice(0, 7);
        if (outside) return <span key={day} className="bk-padding" aria-hidden="true"/>;
        const label = fullDay(day) + ", " + describe(day);
        const marker = mark?.(day);
        return <button type="button" key={day} title={label} aria-label={label}
          aria-current={day === today ? "date" : undefined} aria-pressed={selected === day}
          disabled={!enabled(day)} onClick={() => onPick(day)}>
          <span className="bk-tiny-weekday">{weekdays[dayOfWeek(day)]} </span>{Number(day.slice(8))}
          {marker && <i aria-hidden="true" data-mark={marker}/>}
        </button>;
      })}
    </div>
  </div>;
}
