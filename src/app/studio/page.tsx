import { PageHeading } from "@/components/ui";
import Link from "next/link";
import {ArrowRight,CalendarDays,ArrowUpRight} from "lucide-react";
import {shortDay,todayInStudio} from "@/features/booking/calendar";
import {requireStaff} from "@/features/studio/session";
import {readWorkshop} from "@/features/studio/workshop";
import {StudioShell} from "@/features/studio/Shell";

export default async function TodayPage() {
  const {supabase}=await requireStaff();
  const workshop=await readWorkshop();
  const today=todayInStudio(new Date(),workshop.timezone);
  const groups=[["draft","Черновики"],["published","Опубликованы"],["archived","Архив"]] as const;
  const counts=await Promise.all(groups.map(([status])=>supabase.from("products").select("id",{count:"exact",head:true}).eq("status",status)));
  if(counts.some(r=>r.error)) throw new Error("Не удалось загрузить ассортимент.");
  return <StudioShell active="today"><p className="rs-cap">Мастерская</p><PageHeading title="Сегодня" />
  <div className="rs-today-grid"><section className="rs-date-poster"><p className="rs-cap">{workshop.timezone}</p><span className="rs-poster-day">{Number(today.slice(-2))}</span><div><strong>{shortDay(today).split(" ").slice(1).join(" ")}</strong></div><Link href="/studio/calendar"><CalendarDays size={18}/> Календарь <ArrowUpRight size={18}/></Link></section>
  <section className="rs-plan"><p className="rs-cap">Витрина</p><h2>Ассортимент</h2><ul className="rs-inbox">{groups.map(([status,label],i)=><li key={status}><Link href="/studio/products">{label}<strong>{counts[i].count??0}</strong><ArrowRight size={16}/></Link></li>)}</ul><Link className="rs-block" href="/studio/settings">Настройки мастерской</Link></section></div></StudioShell>;
}
