"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ShoppingBag } from "lucide-react";
import { Button, ObjectNumber, Price, StatusTag } from "@/components/ui";
import { BuyerBooking } from "@/features/booking/BuyerBooking";
import { isAvailableWindowLabel } from "@/features/booking/local-availability";
import { track } from "@/lib/analytics";
import { ImageGallery } from "./ImageGallery";
import { FavoriteButton } from "./ProductCard";
import { statusLabel, type Product } from "./products";
import { lineKey, type PurchaseMode, useStore } from "./StoreProvider";

export function ProductDetail({ product }: { product: Product }) {
  const { addLine, cart } = useStore();
  const [mode, setMode] = useState<PurchaseMode>(product.ready ? "ready" : "made");
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState("");
  const line = { slug: product.slug, mode, window: mode === "made" ? slot : null };
  const inCart = cart.some(item => lineKey(item) === lineKey(line));
  function add() {
    if (mode === "made" && (!slot || !isAvailableWindowLabel(slot))) {
      setError("Это окно недоступно. Выберите другое время.");
      track("booking_unavailable", { product: product.slug });
      return;
    }
    setError("");
    addLine(line);
    track("add_to_cart", { product: product.slug, mode });
  }
  return <div className="store-product-page">
    <Link href="/catalog" className="store-back"><ArrowLeft size={16} /> Каталог</Link>
    <div className="store-product-layout">
      <ImageGallery product={product} />
      <div className="store-product-info">
        <div className="store-product-id"><ObjectNumber value={product.number} /><FavoriteButton product={product} /></div>
        <h1>{product.title}</h1><StatusTag tone={product.ready ? "success" : "neutral"}>{statusLabel(product)}</StatusTag>
        <p className="store-description">{product.description}</p>
        <dl className="store-specs"><div><dt>Категория</dt><dd>{product.category}</dd></div><div><dt>Масштаб</dt><dd>{product.scale}</dd></div><div><dt>Материалы</dt><dd>{product.material}</dd></div></dl>
        {product.status === "active" && <>
          <fieldset className="store-methods"><legend>Способ заказа</legend>
            {([["ready", "Готовый экземпляр", product.ready], ["made", "Изготовление под заказ", product.made]] as const).filter(([, , enabled]) => enabled).map(([v, label]) =>
              <label key={v}><input type="radio" name="purchase-mode" value={v} checked={mode === v} onChange={() => { setMode(v); setSlot(null); setError(""); }} />{label}</label>)}
          </fieldset>
          {mode === "made" && <div className="store-booking"><BuyerBooking onSelect={setSlot} /><p className="store-small">Срок изготовления мастер согласует после рассмотрения заявки.</p></div>}
        </>}
        <p className="store-demo-note">Демонстрационная модель. Фото из музейной коллекции, параметры и цены приведены для примера.</p>
      </div>
    </div>
    {product.status === "active" && <aside className="store-purchase-bar" aria-label="Добавление в корзину">
      {error && <p role="alert">{error}</p>}
      <div><Price value={product.price} />
      {inCart ? <Link className="store-primary-link" href="/cart"><Check size={17} />В корзине <ArrowRight size={16} /></Link>
        : <Button disabled={mode === "made" && !slot} onClick={add}><ShoppingBag size={18} />В корзину</Button>}</div>
    </aside>}
  </div>;
}
