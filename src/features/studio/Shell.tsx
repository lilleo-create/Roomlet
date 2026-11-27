import { leaveShowcase } from "@/app/demo/actions";
import { localDemoEnabled } from "@/lib/supabase/config";
import Link from "next/link";
import { Store, CalendarDays, ClipboardList, LayoutDashboard, LogOut, Package, Settings, Users } from "lucide-react";
import { leaveStudio } from "@/app/studio/actions";
import { requireStaff, type StudioSection } from "./session";

const menu = [
  {id:"today", label:"Сегодня", href:"/studio", Icon:LayoutDashboard},
  {id:"calendar", label:"Календарь", href:"/studio/calendar", Icon:CalendarDays},
  {id:"orders", label:"Заказы", href:"/studio/orders", Icon:ClipboardList},
  {id:"products", label:"Изделия", href:"/studio/products", Icon:Package},
  {id:"settings", label:"Настройки", href:"/studio/settings", Icon:Settings},
];
export async function StudioShell({active, children}: {active: StudioSection; children: React.ReactNode}) {
  const { role, showcase } = await requireStaff();
  const sections = role === "owner" && !showcase ? [...menu, {id:"team", label:"Команда", href:"/studio/team", Icon:Users}] : menu;
  return <div className="rs-shell">
    <header className="rs-header">
      <Link href="/studio" className="rs-brand"><span className="rs-logotype">roomlet<span>.</span></span><span className="rs-stamp">Studio</span></Link>
      <div className="rs-header-actions"><Link href="/" aria-label="Вернуться в магазин" title="Вернуться в магазин"><span>Вернуться в магазин</span><Store size={18} aria-hidden="true"/></Link><form action={leaveStudio}><button aria-label="Выйти из Studio" title="Выйти из Studio"><LogOut size={17}/></button></form></div>
    </header>
    <nav className={role === "owner" && !showcase ? "rs-nav rs-nav-owner" : "rs-nav"} aria-label="Мастерская">{sections.map(({id,label,href,Icon}) =>
      <Link href={href} key={id} aria-current={active === id ? "page" : undefined}><Icon strokeWidth={1.7} size={19} aria-hidden/><span>{label}</span></Link>)}</nav>
    <main className="rs-content">{active === "today" && !localDemoEnabled() && <div className="rs-environment">
      <span>{showcase ? "Демонстрационная мастерская" : "Рабочая мастерская"}</span>
      {showcase ? <form action={leaveShowcase}><button>В рабочую мастерскую</button></form> : <Link href="/demo">Открыть демоверсию</Link>}
    </div>}{showcase && active !== "today" && <p className="rs-cap">Демонстрационная мастерская</p>}{children}</main>
  </div>;
}
