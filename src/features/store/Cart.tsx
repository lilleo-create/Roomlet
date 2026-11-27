"use client";

import { Photo } from "@/components/Photo";
import { ProductPrice } from "./ProductPrice";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { Button, EmptyState, IconButton, Input, Select } from "@/components/ui";
import { startsFromDays, windowLabel } from "@/features/booking/calendar";
import { track } from "@/lib/analytics";
import { findProduct, type Product } from "./products";
import { lineKey, useStore } from "./StoreProvider";

export function CartPage({ products }: { products: Product[] }) {
  const { cart, removeLine, submitRequest, demo } = useStore();
  const [checkout, setCheckout] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const totals = new Map<string, number>();
  for (const line of cart) {
    const product = findProduct(products, line.slug);
    if (product) totals.set(product.currency, (totals.get(product.currency) ?? 0) + product.priceMinor);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!demo || saving) return;
    const form = new FormData(event.currentTarget);
    if (cart.some(line => line.mode === "made")) {
      setSaving(true);
      try {
        const response = await fetch("/api/availability", {cache: "no-store"});
        if (!response.ok) throw new Error();
        const { days } = await response.json();
        const valid = new Set(startsFromDays(days).map(windowLabel));
        if (cart.some(line => line.mode === "made" && (!line.window || !valid.has(line.window)))) {
          setError("Выбранное окно уже недоступно. Удалите позицию и выберите другую дату в карточке.");
          track("booking_unavailable");
          return;
        }
      } catch {
        setError("Не удалось проверить доступность. Попробуйте ещё раз.");
        return;
      } finally { setSaving(false); }
    }
    if (!String(form.get("contact") ?? "").trim()) {
      setError("Укажите контакт для демонстрационной заявки.");
      return;
    }
    track("order_created", { items: cart.length, demo: true });
    for (const line of cart.filter(item => item.mode === "made")) track("booking_requested", { product: line.slug });
    submitRequest(String(form.get("method")));
    setConfirmed(true);
    setError("");
  }
  if (!demo) return <section className="store-page"><h1>Корзина</h1><EmptyState title="Оформление заказов пока недоступно" action={<Link className="store-primary-link" href="/catalog">В каталог</Link>} /></section>;
  return <section className="store-page store-narrow"><div className="store-page-head"><h1>Корзина</h1></div>
    {!cart.length ? <EmptyState title={confirmed ? "Демо-заявка сохранена" : "Корзина пока пуста"} description={confirmed ? "Черновик доступен в профиле на этом устройстве. Средства не списывались." : "Выберите готовую миниатюру или изготовление под заказ."} action={<Link href={confirmed ? "/profile" : "/catalog"} className="store-primary-link">{confirmed ? "Открыть профиль" : "В каталог"} <ArrowRight size={17} /></Link>} />
      : <><div>{cart.map(line => {
        const product = findProduct(products, line.slug);
        if (!product) return <article key={lineKey(line)} className="store-cart-item"><p>Изделие больше недоступно</p><Button variant="quiet" onClick={() => removeLine(lineKey(line))}>Удалить</Button></article>;
        return <article className="store-cart-item" key={lineKey(line)}>
          <Link href={`/product/${line.slug}`} className="store-cart-image" tabIndex={-1} aria-hidden="true"><Photo photo={product.media[0]} sizes="96px" /></Link>
          <div><Link href={`/product/${line.slug}`}>{product.title}</Link><p>{line.mode === "ready" ? "Готовый экземпляр" : `Под заказ · ${line.window}`}</p><ProductPrice product={product} /></div>
          <IconButton label={`Удалить: ${product.title}`} onClick={() => { removeLine(lineKey(line)); setError(""); }}><Trash2 size={17} /></IconButton>
        </article>;})}</div>
        {totals.size > 0 && <div className="store-total"><span>Итого</span><div className="store-total-amounts">
          {Array.from(totals, ([currency, priceMinor]) => <ProductPrice key={currency} product={{currency, priceMinor}} />)}
        </div></div>}
        {checkout ? <form className="store-form" onSubmit={submit}><h2>Демонстрационная заявка</h2>
          <p>Контакт нужен для примера оформления. Он останется только в форме.</p>
          <Input label="Контакт" name="contact" placeholder="Имя пользователя или электронная почта" required maxLength={120} autoComplete="off" />
          <Select name="method" label="Способ получения"><option>Самовывоз</option><option>Доставка</option></Select>
          {error && <p role="alert">{error}</p>}<Button type="submit" disabled={saving}>Сохранить демо-заявку</Button>
        </form> : <Button onClick={() => { setCheckout(true); track("begin_checkout", { items: cart.length }); }}>Оформить заявку <ArrowRight size={18} /></Button>}
      </>}
  </section>;
}
