"use client";

import { useId, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Dialog } from "@/components/ui";
import { Calendar } from "./CalendarGrid";
import { fullDay, type DayKey } from "./calendar";

type Props = { label: string; name: string; today: DayKey; min?: DayKey; timezone?: string };

export function DatePicker({ label, name, today, min, timezone }: Props) {
  const [value, setValue] = useState<DayKey | null>(null);
  const [anchor, setAnchor] = useState(today);
  const [open, setOpen] = useState(false);
  const id = useId();
  const selected = value && (!min || value >= min) ? value : null;
  function choose(day: DayKey | null) { setValue(day); setOpen(false); }

  return <div className="ui-field bk-picker">
    <label id={id + "-label"} htmlFor={id}>{label}</label>
    <input type="hidden" name={name} value={selected ?? ""}/>
    <button type="button" id={id} className="ui-control bk-picker-trigger" aria-haspopup="dialog"
      aria-expanded={open} aria-labelledby={id + "-label " + id + "-value"}
      onClick={() => { setAnchor(selected ?? today); setOpen(true); }}>
      <span id={id + "-value"}>{selected ? fullDay(selected) : "Выбрать дату"}</span><CalendarDays size={18} aria-hidden/>
    </button>
    <Dialog open={open} onClose={() => setOpen(false)} title={label}>
      {timezone && <p className="bk-zone">Часовой пояс мастерской · {timezone}</p>}
      <Calendar anchor={anchor} today={today} selected={selected} onPick={choose} onNavigate={setAnchor} min={min}/>
      {selected && <button type="button" className="bk-clear" onClick={() => choose(null)}>Очистить дату</button>}
    </Dialog>
  </div>;
}
