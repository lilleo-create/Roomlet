"use client";
import {useState} from "react";
import Link from "next/link";
import {Calendar} from "../booking/CalendarGrid";
import {addDays,dayOfWeek,fullDay,moveMonth} from "../booking/calendar";
import type {Workshop} from "./workshop";

export function StudioCalendar({today,workshop}:{today:string;workshop:Workshop}) {
  const [day,setDay]=useState(today);
  const [mode,setMode]=useState<"week"|"month">("month");
  function describe(d:string) {
    if (workshop.blocks.some(b=>d>=b.start_date&&d<=b.end_date)) return "Заблокировано";
    const minutes=workshop.hours.find(h=>h.weekday===dayOfWeek(d)+1)?.minutes??0;
    if (!minutes) return "Выходной";
    return Math.max(0,minutes-workshop.bufferMinutes)+" мин свободно по графику";
  }
  return <><div className="rs-page-title"><h1>Календарь</h1><div className="rs-switch" role="group" aria-label="Вид календаря">{(["month","week"] as const).map(m=><button key={m} aria-pressed={mode===m} onClick={()=>setMode(m)}>{m==="month"?"Месяц":"Неделя"}</button>)}</div></div>
  <div className="rs-cal-layout"><section className="rs-cal-main"><Calendar anchor={day} selected={day} today={today} mode={mode} onPick={setDay}
  onMove={step=>setDay(mode==="week"?addDays(day,step*7):moveMonth(day,step))} canMove={()=>true} describe={describe} enabled={()=>true}
  mark={d=>describe(d)==="Заблокировано"?"blocked":describe(d)==="Выходной"?"weekend":"free"}/></section>
  <section className="rs-selected"><p className="rs-cap">{workshop.timezone}</p><h2>{fullDay(day)}</h2><p>{describe(day)}</p>
  {workshop.blocks.filter(b=>day>=b.start_date&&day<=b.end_date).map(b=><p key={b.id}>{b.reason}</p>)}
  <Link className="rs-block" href={"/studio/settings?day="+day}>Управлять периодом</Link></section></div></>;
}
