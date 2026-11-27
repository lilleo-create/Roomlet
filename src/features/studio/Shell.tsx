import Link from "next/link";
import { Store, CalendarDays, ClipboardList, LayoutDashboard, LogOut, Package } from "lucide-react";
import { leaveStudio } from "@/app/studio/actions";
import type { StudioSection } from "./session";

const menu = [
  {id:"today", label:"Сегодня", href:"/studio", Icon:LayoutDashboard},
  {id:"calendar", label:"Календарь", href:"/studio/calendar", Icon:CalendarDays},
  {id:"orders", label:"Заказы", href:"/studio/orders", Icon:ClipboardList},
  {id:"products", label:"Изделия", href:"/studio/products", Icon:Package},
];
export function StudioShell({active, children}: {active: StudioSection; children: React.ReactNode}) {
  return <div className="rs-shell">
    <header className="rs-header">
      <Link href="/studio" className="rs-brand"><span className="rs-logotype">roomlet<span>.</span></span><span className="rs-stamp">Studio</span></Link>
      <div className="rs-header-actions"><Link href="/" aria-label="Магазин" title="Магазин"><span>Магазин</span><Store size={18} aria-hidden="true"/></Link><form action={leaveStudio}><button aria-label="Выйти из Studio" title="Выйти из Studio"><LogOut size={17}/></button></form></div>
    </header>
    <nav className="rs-nav" aria-label="Мастерская">{menu.map(({id,label,href,Icon}) =>
      <Link href={href} key={id} aria-current={active === id ? "page" : undefined}><Icon strokeWidth={1.7} size={19}/><span>{label}</span></Link>)}</nav>
    <main className="rs-content">{children}</main>
  </div>;
}
