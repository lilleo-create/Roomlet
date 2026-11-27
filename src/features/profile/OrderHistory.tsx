"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { lineKey, useStore } from "@/features/store/StoreProvider";
import { findProduct, type Product } from "@/features/store/products";
import { fullDay, validDate } from "@/features/booking/calendar";
import { useClock } from "@/features/booking/useClock";

export function OrderHistory({ products }: { products: Product[] }) {
  const { orders, briefs } = useStore();
  const clock = useClock();
  const dateTime = clock && new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: clock.timeZone });
  if (!orders.length && !briefs.length) return <EmptyState variant="orders" title="Заказов пока нет"
    description="Выберите миниатюру или расскажите о своём проекте."
    action={<Link href="/catalog" className="store-primary-link">В каталог <ArrowRight size={18} aria-hidden /></Link>} />;
  return <>
    {orders.map(order => <article className="store-request" key={order.id}>
      <h2>Заявка № {order.id.slice(0, 6).toUpperCase()}</h2>
      <small>{dateTime && Number.isFinite(Date.parse(order.date)) && <><time dateTime={order.date}>{dateTime.format(new Date(order.date))}</time> · </>}Демозаявка</small>
      <ul>{order.lines.map(line => <li key={lineKey(line)}>{findProduct(products, line.slug)?.title || "Изделие"} · {line.mode === "ready" ? "Готовый экземпляр" : line.window}</li>)}</ul>
      <p>Получение: {order.method}</p>
    </article>)}
    {briefs.map(brief => <article className="store-request" key={brief.id}>
      <h2>Индивидуальный проект</h2><small>Демозаявка</small><p>{brief.idea}</p>
      {brief.budget && <p>Бюджет: {brief.budget} ₽</p>}
      {brief.deadline && <p>Желаемый срок: {validDate(brief.deadline) ? fullDay(brief.deadline) : brief.deadline}</p>}
      {brief.reference && <p>Референс: {brief.reference}</p>}
    </article>)}
  </>;
}
