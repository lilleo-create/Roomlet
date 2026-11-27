import Link from "next/link";
import { requireDemo } from "@/features/studio/session";
import { StudioShell } from "@/features/studio/Shell";
import { orders } from "@/features/studio/data";
import { todayInStudio, shortDay } from "@/features/booking/calendar";
import { OrderCard } from "@/components/patterns";

export default async function OrdersPage({searchParams}: {searchParams:Promise<{status?:string}>}) {
  await requireDemo("orders");
  const {status} = await searchParams;
  const all = orders(todayInStudio());
  const filtered = status ? all.filter((order) => order.status === status) : all;
  return <StudioShell active="orders"><p className="rs-cap">Мастерская</p><div className="rs-page-title"><h1>Заказы</h1><span className="rs-demo">Деморежим</span></div>
    {status && <p>{status} · <Link href="/studio/orders">Все заказы</Link></p>}
    <div className="rs-orders">{filtered.map((o) => <div id={o.number} key={o.number}><OrderCard number={o.number} title={o.title} status={o.status} detail={o.info + " · " + shortDay(o.due)}/></div>)}</div>
    {!filtered.length && <p>Заказов с таким статусом нет.</p>}
  </StudioShell>;
}
