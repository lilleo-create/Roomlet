"use client";
import {useEffect,useState} from "react";
import {track} from "@/lib/analytics";
import {addDays,firstOfMonth,moveMonth,startsFromDays,windowLabel,type PublicDay} from "./calendar";
import {Calendar} from "./CalendarGrid";
import {BookingWindow} from "./BookingWindow";
import "@/styles/studio.css";

export function BuyerBooking({onSelect}:{onSelect:(value:string|null)=>void}) {
  const [days,setDays]=useState<PublicDay[]|null>(null);
  const [failed,setFailed]=useState(false);
  const [attempt,retry]=useState(0);
  const [chosen,setChosen]=useState<string|null>(null);
  const [month,setMonth]=useState<string|null>(null);
  useEffect(()=>{
    let controller:AbortController|undefined;
    async function refresh() {
      controller?.abort();
      const own=new AbortController();
      controller=own;
      try {
        const response=await fetch("/api/availability",{cache:"no-store",signal:own.signal});
        if (!response.ok) throw new Error("unavailable");
        const data=await response.json();
        if (!own.signal.aborted) {setDays(data.days);setFailed(false);}
      } catch {
        if (!own.signal.aborted) {setDays([]);setFailed(true);}
      }
    }
    void refresh();
    window.addEventListener("focus",refresh);
    return ()=>{controller?.abort();window.removeEventListener("focus",refresh);};
  },[attempt]);
  useEffect(()=>{track("booking_calendar_view");},[]);
  const starts=startsFromDays(days??[]);
  const valid=chosen!==null && starts.includes(chosen);
  useEffect(()=>{onSelect(valid&&chosen ? windowLabel(chosen):null);},[valid,chosen,onSelect]);
  if (failed) return <p role="status">Расписание недоступно. <button type="button" onClick={()=>retry(attempt+1)}>Повторить</button></p>;
  if (!days) return <p aria-busy="true">Загрузка календаря…</p>;
  if (!days.length||!starts.length) return <p role="status">Свободных окон пока нет.</p>;
  const first=firstOfMonth(days[0].day),last=firstOfMonth(days[days.length-1].day);
  const anchor=month&&month>=first&&month<=last?month:firstOfMonth(starts[0]);
  return <section className="bk-buyer" aria-label="Выбор производственного окна">
  <Calendar anchor={anchor} mode="month" selected={valid?chosen:null} today={addDays(days[0].day,-1)}
  onPick={day=>{if(starts.includes(day)){setChosen(day);track("booking_window_select",{start:day});}}}
  onMove={step=>setMonth(moveMonth(anchor,step))} canMove={step=>moveMonth(anchor,step)>=first&&moveMonth(anchor,step)<=last}
  enabled={day=>starts.includes(day)} describe={day=>starts.includes(day)?"Можно выбрать начало":"Недоступно"}/>
  <BookingWindow start={valid?chosen:null}/></section>;
}
