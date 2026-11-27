"use client";

import { useState } from "react";
import { Calendar } from "./CalendarGrid";
import { fullDay, type DayKey } from "./calendar";
import { selectRange, type DateRange } from "./selection";

type Props = {
  today: DayKey;
  value: DateRange;
  onChange: (value: DateRange) => void;
  blocked?: { start_date: DayKey; end_date: DayKey }[];
  startName: string;
  endName: string;
};

export function DateRangePicker({ today, value, onChange, blocked = [], startName, endName }: Props) {
  const [view, setView] = useState<DayKey | null>(null);
  const selectingEnd = Boolean(value.start && !value.end);
  function blockedReason(day: DayKey) {
    if (blocked.some(b => b.start_date <= day && b.end_date >= day)) return "Уже заблокировано";
    if (selectingEnd && value.start) {
      const left = day < value.start ? day : value.start;
      const right = day > value.start ? day : value.start;
      if (blocked.some(b => b.start_date <= right && b.end_date >= left)) return "В периоде есть блокировка";
    }
    return "";
  }
  return <fieldset className="bk-picker">
    <legend>Период блокировки</legend>
    <input type="hidden" name={startName} value={value.start ?? ""}/>
    <input type="hidden" name={endName} value={value.end ?? ""}/>
    <dl className="bk-range-fields">
      <div data-active={!selectingEnd || undefined}><dt>С даты</dt><dd>{value.start ? fullDay(value.start) : "Не выбрана"}</dd></div>
      <div data-active={selectingEnd || undefined}><dt>По дату включительно</dt><dd>{value.end ? fullDay(value.end) : "Не выбрана"}</dd></div>
    </dl>
    <Calendar anchor={view ?? value.start ?? today} today={today} range={value} onNavigate={setView}
      enabled={day => !blockedReason(day)} describe={blockedReason} mark={day => blockedReason(day) === "Уже заблокировано" ? "blocked" : undefined}
      onPick={day => { setView(day); onChange(selectRange(value, day)); }}/>
    <div className="bk-range-actions">
      <p role="status" className="bk-picker-status">{selectingEnd
        ? "Выберите последний день. Для одного дня нажмите ту же дату ещё раз."
        : value.end && value.start ? fullDay(value.start) + " — " + fullDay(value.end)
        : "Выберите первый день."}</p>
      {value.start && <button type="button" className="bk-clear" onClick={() => onChange({ start: null, end: null })}>Сбросить</button>}
    </div>
  </fieldset>;
}
