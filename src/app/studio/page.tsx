import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays } from "lucide-react";
import { todayInStudio, shortDay, dayOfWeek } from "@/features/booking/calendar";
import { agenda, orders } from "@/features/studio/data";
import { StudioShell } from "@/features/studio/Shell";
import { Agenda } from "@/features/studio/Agenda";
import { requireDemo } from "@/features/studio/session";

const days = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
export default async function TodayPage() {
  await requireDemo("today");
  const today = todayInStudio();
  const tasks = agenda(today);
  const currentOrders = orders(today);
  const counts = [
    {title:"Новые заявки", status:"Новая заявка"},
    {title:"Эскизы на согласовании", status:"Эскиз на согласовании"},
    {title:"Заказы в работе", status:"В работе"},
  ];
  return <StudioShell active="today">
    <p className="rs-cap">Рабочее пространство</p><div className="rs-page-title"><h1>Сегодня</h1><span className="rs-demo">Деморежим</span></div>
    <div className="rs-today-grid">
      <section className="rs-date-poster"><p className="rs-cap">План мастерской</p>
        <span className="rs-poster-day">{Number(today.slice(8))}</span>
        <div><strong>{shortDay(today).split(" ").slice(1).join(" ")}</strong><p>{days[dayOfWeek(today)]}</p></div>
        <Link href="/studio/calendar"><CalendarDays size={18}/> Календарь <ArrowUpRight size={18}/></Link>
      </section>
      <section className="rs-plan"><p className="rs-cap">Расписание</p><div className="rs-heading"><h2>План на день</h2><span>{String(tasks.length).padStart(2,"0")}</span></div><Agenda tasks={tasks}/></section>
    </div>
    <div className="rs-lower-grid"><section><p className="rs-cap">Мастерская</p><h2>На контроле</h2>
      <ul className="rs-inbox">{counts.map(({title,status}) => <li key={status}><Link href={"/studio/orders?status=" + encodeURIComponent(status)}>{title}<strong>{currentOrders.filter((o) => o.status === status).length}</strong><ArrowRight size={17}/></Link></li>)}</ul>
    </section><section><p className="rs-cap">Заказы</p><h2>Ближайший срок</h2><Link className="rs-deadline" href={"/studio/orders#" + currentOrders[0].number}><span>{shortDay(currentOrders[0].due)} <ArrowUpRight size={17}/></span><strong>{currentOrders[0].title}</strong><small>{currentOrders[0].info} · {currentOrders[0].number}</small></Link></section></div>
  </StudioShell>;
}
