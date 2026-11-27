"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { Button, EmptyState, IconButton, Input, Price, Select } from "@/components/ui";
import { isAvailableWindowLabel } from "@/features/booking/local-availability";
import { track } from "@/lib/analytics";
import { findProduct } from "./products";
import { lineKey, useStore } from "./StoreProvider";

export function CartPage() {
  const { cart, removeLine, submitRequest } = useStore();
  const [checkout, setCheckout] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const total = cart.reduce((sum, line) => sum + (findProduct(line.slug)?.price ?? 0), 0);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const unavailable = cart.find(line => line.mode === "made" && (!line.window || !isAvailableWindowLabel(line.window)));
    if (unavailable) {
      setError(`Окно для объекта «${findProduct(unavailable.slug)?.title}» уже недоступно. Удалите позицию и выберите другое окно в карточке.`);
      track("booking_unavailable", { product: unavailable.slug });
      return;
    }
    const form = new FormData(event.currentTarget);
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
  return <section className="store-page store-narrow"><div className="store-page-head"><h1>Корзина</h1></div>
    {!cart.length ? <EmptyState title={confirmed ? "Демо-заявка сохранена" : "Корзина пока пуста"} description={confirmed ? "Черновик доступен в профиле на этом устройстве. Средства не списывались." : "Выберите готовую миниатюру или изготовление под заказ."} action={<Link href={confirmed ? "/profile" : "/catalog"} className="store-primary-link">{confirmed ? "Открыть профиль" : "В каталог"} <ArrowRight size={17} /></Link>} />
      : <><div>{cart.map(line => {
        const product = findProduct(line.slug)!;
        return <article className="store-cart-item" key={lineKey(line)}>
          <Link href={`/product/${line.slug}`} className="store-cart-image" tabIndex={-1} aria-hidden="true"><Image src={product.image} alt="" fill sizes="96px" /></Link>
          <div><Link href={`/product/${line.slug}`}>{product.title}</Link><p>{line.mode === "ready" ? "Готовый экземпляр" : `Под заказ · ${line.window}`}</p><Price value={product.price} /></div>
          <IconButton label={`Удалить: ${product.title}`} onClick={() => { removeLine(lineKey(line)); setError(""); }}><Trash2 size={17} /></IconButton>
        </article>;})}</div>
        <p className="store-total"><span>Итого</span><Price value={total} /></p>
        {checkout ? <form className="store-form" onSubmit={submit}><h2>Демонстрационная заявка</h2>
          <p>Контакт нужен для примера оформления. Он останется только в форме.</p>
          <Input label="Контакт" name="contact" placeholder="Имя пользователя или электронная почта" required maxLength={120} autoComplete="off" />
          <Select name="method" label="Способ получения"><option>Самовывоз</option><option>Доставка</option></Select>
          {error && <p role="alert">{error}</p>}<Button type="submit">Сохранить демо-заявку</Button>
        </form> : <Button onClick={() => { setCheckout(true); track("begin_checkout", { items: cart.length }); }}>Оформить заявку <ArrowRight size={18} /></Button>}
      </>}
  </section>;
}
