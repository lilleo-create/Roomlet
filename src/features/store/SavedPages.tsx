"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { ProductCard } from "./ProductCard";
import { findProduct, products } from "./products";
import { lineKey, useStore } from "./StoreProvider";

export function FavoritesPage() {
  const { favorites } = useStore();
  return <section className="store-page"><div className="store-page-head"><h1>Избранное</h1></div>
    {favorites.length ? <div className="store-grid">{products.filter(p => favorites.includes(p.slug)).map(p => <ProductCard key={p.slug} product={p} />)}</div>
    : <EmptyState title="Соберите свою подборку" description="Нажимайте на сердце у понравившихся объектов." action={<Link href="/catalog" className="store-primary-link">В каталог <ArrowRight size={18} /></Link>} />}
  </section>;
}
export function ProfilePage() {
  const { orders, briefs, favorites } = useStore();
  return <section className="store-page store-narrow"><div className="store-page-head"><h1>Профиль</h1><p>Здесь хранятся ваши демо-заявки на этом устройстве.</p></div>
    <Link className="store-profile-link" href="/favorites">Избранное · {favorites.length}<ArrowRight size={18} /></Link>
    <section className="store-section"><h2>История заявок</h2>
    {!orders.length && !briefs.length && <EmptyState title="Заявок пока нет" description="Выберите объект в каталоге или расскажите о своём проекте." action={<Link className="store-primary-link" href="/catalog">В каталог</Link>} />}
    {orders.map(order => <article className="store-request" key={order.id}><h3>Заявка № {order.id.slice(0, 6).toUpperCase()}</h3>
      <small>{new Date(order.date).toLocaleDateString("ru-RU")} · Локальный черновик</small><ul>{order.lines.map(line => <li key={lineKey(line)}>{findProduct(line.slug)?.title} · {line.mode === "ready" ? "Готовый экземпляр" : line.window}</li>)}</ul><p>Получение: {order.method}</p></article>)}
    {briefs.map(brief => <article className="store-request" key={brief.id}><h3>Индивидуальный проект</h3><small>Локальный черновик</small><p>{brief.idea}</p>
      {brief.budget && <p>Бюджет: {brief.budget} ₽</p>}{brief.deadline && <p>Желаемый срок: {brief.deadline}</p>}{brief.reference && <p>Референс: {brief.reference}</p>}</article>)}
    </section></section>;
}
