"use client";

import { useState } from "react";
import { LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { Calendar } from "../booking/CalendarGrid";
import { addDays, dateStatus, firstOfMonth, fullDay, monthDates, moveMonth, shortDay, weekDates, type DayStatus } from "../booking/calendar";
import { useBlockedDates, toggleBlock } from "../booking/local-availability";
import { Agenda } from "./Agenda";
import type { calendarFixture } from "./data";

const statuses: Record<DayStatus, string> = {free:"Есть свободное время",busy:"Занято",weekend:"Выходной",blocked:"Заблокировано"};
export function StudioCalendar({today, fixture}: {today:string;fixture:ReturnType<typeof calendarFixture>}) {
  const [mode,setMode] = useState<"month"|"week">("month");
  const [selected,pick] = useState(today);
  const [feedback,setFeedback] = useState("");
  const blocks = useBlockedDates();
  const status = dateStatus(selected, blocks);
  const isBlocked = status === "blocked";
  function targetDate(offset: number) {
    const target = mode === "week" ? addDays(selected, 7 * offset) : moveMonth(selected, offset);
    return target < fixture.first ? fixture.first : target > fixture.last ? fixture.last : target;
  }
  function canMove(offset: number) {
    const grid = mode === "week" ? weekDates(selected) : monthDates(selected).filter((d) => firstOfMonth(d) === firstOfMonth(selected));
    return offset < 0 ? grid[0] > fixture.first : grid.at(-1)! < fixture.last;
  }
  function select(day: string) {
    pick(day);
    setFeedback("");
  }
  function switchBlock() {
    const saved = toggleBlock(selected);
    setFeedback(saved ? (isBlocked ? "Блокировка снята." : "Дата закрыта для выбора покупателем.") : "Браузер не сохранил изменение. Проверьте доступ к локальному хранилищу.");
  }
  return <>
    <div className="rs-page-title"><h1>Календарь</h1><div className="rs-switch" role="group" aria-label="Вид календаря">
      <button type="button" aria-pressed={mode === "month"} onClick={() => setMode("month")}>Месяц</button>
      <button type="button" aria-pressed={mode === "week"} onClick={() => setMode("week")}>Неделя</button>
    </div></div>
    <div className="rs-cal-layout">
      <div className="rs-cal-main"><Calendar anchor={selected} selected={selected} today={today} mode={mode} onPick={select}
        onMove={(step) => select(targetDate(step))} canMove={canMove}
        describe={(day) => statuses[dateStatus(day, blocks)]} enabled={(day) => day >= fixture.first && day <= fixture.last}
        mark={(day) => dateStatus(day, blocks)}/>
        <ul className="rs-key">{Object.entries(statuses).map(([id, label]) => <li key={id}><i data-mark={id}/>{label}</li>)}</ul>
        <p className="rs-range">Демо-период · {shortDay(fixture.first)} — {fullDay(fixture.last)}</p>
      </div>
      <section className="rs-selected"><p className="rs-cap">План на день</p><h2>{shortDay(selected)}</h2><span className="rs-daystatus">{statuses[status]}</span>
        <Agenda tasks={fixture.schedule[selected] ?? []}/>
        {selected >= today && <button className="rs-block" type="button" onClick={switchBlock}>
          {isBlocked ? <LockKeyholeOpen size={17}/> : <LockKeyhole size={17}/>} {isBlocked ? "Снять блокировку" : "Закрыть дату"}</button>}
        <p role="status" className="rs-feedback">{feedback}</p>
      </section>
    </div>
    <p className="rs-calendar-note">Рабочие дни — с понедельника по пятницу. Среда отведена под текущую загрузку. Изменения доступности сохраняются в этом браузере.</p>
  </>;
}
