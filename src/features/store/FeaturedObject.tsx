"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Photo } from "@/components/Photo";
import { IconButton } from "@/components/ui";
import { statusLabel, type Product } from "./products";

function availabilityOrder(product: Product) {
  if (product.ready) return 0;
  if (product.made) return 1;
  return product.status === "upcoming" ? 2 : 3;
}

export function FeaturedObject({ heading: Heading = "h1", products }: { heading?: "h1" | "h3"; products: readonly Product[] }) {
  const [index, setIndex] = useState(0);
  const slides = useMemo(() => [...products].sort((a, b) => availabilityOrder(a) - availabilityOrder(b)), [products]);
  const active = slides.length ? index % slides.length : 0;
  const current = slides[active];
  return <section className="store-hero" aria-label="Мастерская миниатюр">
    <div className="store-hero-copy">
      <Heading className="store-hero-title">Комнаты <span className="store-hero-line">в миниатюре<span className="store-hero-dot">.</span></span></Heading>
      <p>Интерьеры ручной работы — готовые миниатюры и комнаты на заказ.</p>
      <Link className="store-primary-link" href="/catalog">Смотреть каталог <ArrowRight size={18} aria-hidden /></Link>
    </div>
    {current ? <div className="store-hero-piece">
      <div className="store-hero-photo">
        <Link href={`/product/${current.slug}`} aria-label={`Рассмотреть объект «${current.title}»`}>
          <Photo key={current.slug} photo={current.media[0]} priority={active === 0} sizes="(max-width: 760px) 100vw, 55vw" />
        </Link>
        <span className="store-object-label">{statusLabel(current)}</span>
      </div>
      <div className="store-hero-caption">
        <Link href={`/product/${current.slug}`}>{current.title} <ArrowUpRight size={16} aria-hidden /></Link>
        {slides.length > 1 && <div className="store-carousel-tools">
          <IconButton label="Предыдущий объект" onClick={() => setIndex((active + slides.length - 1) % slides.length)}><ChevronLeft size={16} /></IconButton>
          <span aria-live="polite" aria-atomic="true">{active + 1} / {slides.length}</span>
          <IconButton label="Следующий объект" onClick={() => setIndex((active + 1) % slides.length)}><ChevronRight size={16} /></IconButton>
        </div>}
      </div>
    </div> : <figure className="store-hero-piece store-atelier">
      <div className="store-hero-photo">
        <Photo photo={{ src: "/images/workshop-materials.webp", alt: "Миниатюрная оконная рама, шпон и кисть" }} priority sizes="(max-width: 760px) 100vw, 55vw" />
      </div>
      <figcaption>Готовим новые миниатюры</figcaption>
    </figure>}
  </section>;
}
