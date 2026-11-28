"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ShoppingBag } from "lucide-react";
import { Button, ObjectNumber } from "@/components/ui";
import { BuyerBooking } from "@/features/booking/BuyerBooking";
import { ProductPrice } from "./ProductPrice";
import { track } from "@/lib/analytics";
import { ImageGallery } from "./ImageGallery";
import { FavoriteButton, ProductStatus } from "./ProductCard";
import type { Product } from "./products";
import { lineKey, type PurchaseMode, useStore } from "./StoreProvider";

export function ProductDetail({ product }: { product: Product }) {
  const { addLine, cart, demo } = useStore();
  const [mode, setMode] = useState<PurchaseMode>(product.ready ? "ready" : "made");
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState("");
  const line = { slug: product.slug, mode, window: mode === "made" ? slot : null };
  const inCart = cart.some(item => lineKey(item) === lineKey(line));
  function add() {
    if (mode === "made" && !slot) {
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
        <div className="store-product-id"><ObjectNumber value={"№ " + product.number} /><FavoriteButton product={product} /></div>
        <h1>{product.title}</h1><ProductStatus product={product} />
        {product.status !== "active" && <p className="store-detail-price"><ProductPrice product={product} /></p>}
        <p className="store-description">{product.description}</p>
        <dl className="store-specs"><div><dt>Категория</dt><dd>{product.category}</dd></div>{product.dimensions && <div><dt>Размеры</dt><dd>{product.dimensions}</dd></div>}{product.scale && <div><dt>Масштаб</dt><dd>{product.scale}</dd></div>}{product.material && <div><dt>Материалы</dt><dd>{product.material}</dd></div>}</dl>
        {(product.ready || product.made) && <>
          <fieldset className="store-methods"><legend>Способ заказа</legend>
            {([["ready", "Готовый экземпляр", product.ready], ["made", "Изготовление под заказ", product.made]] as const).filter(([, , enabled]) => enabled).map(([v, label]) =>
              <label key={v}><input type="radio" name="purchase-mode" value={v} checked={mode === v} onChange={() => { setMode(v); setSlot(null); setError(""); }} />{label}</label>)}
          </fieldset>
          {mode === "made" && product.requiresSketch && <p>Изготовление начинается после согласования эскиза.</p>}
          {mode === "made" && <div className="store-booking"><BuyerBooking onSelect={setSlot} /><p className="store-small">Срок изготовления мастер согласует после рассмотрения заявки.</p></div>}
        </>}
        {product.demo && !demo && <p className="store-demo-note">Тестовое изделие. Покупка временно недоступна.</p>}
        {demo && <p className="store-demo-note">Демонстрационное изделие. Заявка сохраняется только на этом устройстве.</p>}
      </div>
    </div>
    {product.status === "active" && <aside className="store-purchase-bar" aria-label={demo ? "Добавление в корзину" : "Стоимость и избранное"}>
      {error && <p role="alert">{error}</p>}
      <div><ProductPrice product={product} />
      {inCart ? <Link className="store-primary-link" href="/cart"><Check size={17} />В корзине <ArrowRight size={16} /></Link>
        : <Button disabled={mode === "made" && !slot} onClick={add}><ShoppingBag size={18} />В корзину</Button>}</div>
    </aside>}
  </div>;
}
