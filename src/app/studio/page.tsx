import { PageHeading } from "@/components/ui";
import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {TodayClock} from "@/features/studio/TodayClock";
import {requireStaff} from "@/features/studio/session";
import {readWorkshop} from "@/features/studio/workshop";
import {StudioShell} from "@/features/studio/Shell";

export default async function TodayPage() {
  const {supabase}=await requireStaff();
  const workshop=await readWorkshop();
  const groups=[["draft","Черновики"],["published","Опубликованы"],["archived","Архив"]] as const;
  const counts=await Promise.all(groups.map(([status])=>supabase.from("products").select("id",{count:"exact",head:true}).eq("status",status)));
  if(counts.some(r=>r.error)) throw new Error("Не удалось загрузить ассортимент.");
  return <StudioShell active="today"><p className="rs-cap">Мастерская</p><PageHeading title="Сегодня" />
  <div className="rs-today-grid"><TodayClock workshopZone={workshop.timezone}/>
  <section className="rs-plan"><p className="rs-cap">Витрина</p><h2>Ассортимент</h2><ul className="rs-inbox">{groups.map(([status,label],i)=><li key={status}><Link href="/studio/products">{label}<strong>{counts[i].count??0}</strong><ArrowRight size={16}/></Link></li>)}</ul><Link className="rs-block" href="/studio/settings">Настройки мастерской</Link></section></div></StudioShell>;
}
