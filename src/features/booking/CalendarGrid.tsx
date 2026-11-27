"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui";
import { addDays, fullDay, monthDates, monthTitle, moveMonth, shortDay, weekdays, weekDates, type DayKey } from "./calendar";
import { calendarKeyTarget, type DateRange } from "./selection";
import "@/styles/calendar.css";

export type DayMarker = "free" | "blocked" | "unavailable";
type Props = {
  anchor: DayKey;
  selected?: DayKey | null;
  range?: DateRange;
  today: DayKey;
  mode?: "month" | "week";
  onPick: (day: DayKey) => void;
  onNavigate: (day: DayKey) => void;
  min?: DayKey;
  max?: DayKey;
  describe?: (day: DayKey) => string;
  enabled?: (day: DayKey) => boolean;
  mark?: (day: DayKey) => DayMarker | undefined;
};

export function Calendar({ anchor, selected, range, today, mode = "month", onPick, onNavigate,
  min, max, describe, enabled, mark }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<DayKey | null>(null);
  const [focused, setFocused] = useState<DayKey | null>(null);
  const isWeek = mode === "week";
  const days = isWeek ? weekDates(anchor) : monthDates(anchor);
  const visible = days.filter(day => isWeek || day.slice(0, 7) === anchor.slice(0, 7));
  const selectable = (day: DayKey) => (!min || day >= min) && (!max || day <= max) && (enabled?.(day) ?? true);
  const tabDay = [focused, selected, range?.start, today].find(day => day && visible.includes(day))
    ?? visible.find(selectable) ?? visible[0];
  const caption = isWeek ? shortDay(days[0]) + " — " + fullDay(days[6]) : monthTitle(anchor);
  const move = (step: number) => isWeek ? addDays(anchor, step * 7) : moveMonth(anchor, step);
  function canOpen(day: DayKey) {
    const period = isWeek ? weekDates(day) : [day.slice(0, 7) + "-01", addDays(moveMonth(day, 1), -1)];
    return (!min || period[period.length - 1] >= min) && (!max || period[0] <= max);
  }

  useLayoutEffect(() => {
    const day = pendingFocus.current;
    if (day) grid.current?.querySelector<HTMLButtonElement>('[data-day="' + day + '"]')?.focus();
    pendingFocus.current = null;
  }, [anchor, focused]);

  function keyDown(event: KeyboardEvent<HTMLButtonElement>, day: DayKey) {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const target = calendarKeyTarget(day, event.key);
    if (!target) return;
    event.preventDefault();
    if (!canOpen(target)) return;
    pendingFocus.current = target;
    if (!visible.includes(target)) onNavigate(target);
    setFocused(target);
  }

  return <div className="bk-calendar">
    <div className="bk-calendar-heading">
      <strong aria-live="polite">{caption}</strong>
      <div className="bk-month-arrows">
        <IconButton label="Предыдущий период" disabled={!canOpen(move(-1))} onClick={() => onNavigate(move(-1))}><ChevronLeft size={18}/></IconButton>
        <IconButton label="Следующий период" disabled={!canOpen(move(1))} onClick={() => onNavigate(move(1))}><ChevronRight size={18}/></IconButton>
      </div>
    </div>
    <div className="bk-grid" ref={grid} role="grid" aria-label={caption} aria-multiselectable={range ? true : undefined}>
      <div className="bk-row" role="row">{weekdays.map(label =>
        <span className="bk-weekday" key={label} role="columnheader">{label}</span>)}</div>
      {Array.from({ length: days.length / 7 }, (_, row) => <div className="bk-row" role="row" key={days[row * 7]}>
        {days.slice(row * 7, row * 7 + 7).map(day => {
          if (!visible.includes(day)) return <div role="gridcell" className="bk-padding" key={day}/>;
          const within = Boolean(range?.start && range.end && day >= range.start && day <= range.end);
          const edge = day === range?.start || day === range?.end;
          const picked = selected === day || edge || within;
          const allowed = selectable(day);
          const status = describe?.(day) || (!allowed ? "Недоступно" : "");
          const label = [fullDay(day), day === today && "Сегодня", status].filter(Boolean).join(", ");
          const marker = mark?.(day);
          return <div key={day} role="gridcell" aria-selected={picked}>
            <button type="button" data-day={day} data-range={edge ? "edge" : within ? "inside" : undefined}
              title={label} aria-label={label} aria-current={day === today ? "date" : undefined}
              aria-pressed={picked} aria-disabled={!allowed || undefined} tabIndex={day === tabDay ? 0 : -1}
              onFocus={() => setFocused(day)} onKeyDown={event => keyDown(event, day)}
              onClick={() => { if (allowed) onPick(day); }}>
              {Number(day.slice(8))}{marker && <i aria-hidden="true" data-mark={marker}/>}
            </button>
          </div>;
        })}
      </div>)}
    </div>
  </div>;
}
