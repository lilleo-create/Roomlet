"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Photo } from "@/components/Photo";
import { IconButton } from "@/components/ui";
import { availabilityOrder, statusLabel, type Product } from "./products";

export function FeaturedObject({ heading: Heading = "h1", products }: { heading?: "h1" | "h3"; products: readonly Product[] }) {
  const [index, setIndex] = useState(0);
  const slides = useMemo(() => [...products].sort((a, b) => availabilityOrder(a) - availabilityOrder(b)), [products]);
  const touch = useRef<{x:number; y:number} | null>(null);
  const swiped = useRef(false);
  const active = slides.length ? index % slides.length : 0;
  const current = slides[active];
  return <section className="store-hero" aria-label="Мастерская миниатюр">
    <div className="store-hero-copy">
      <Heading className="store-hero-title">Комнаты <span className="store-hero-line">в миниатюре<span className="store-hero-dot">.</span></span></Heading>

    </div>
    {current ? <div className="store-hero-piece">
      <div className="store-hero-photo" onTouchStart={event => {
        const point = event.touches[0];
        swiped.current = false;
        touch.current = event.touches.length === 1 ? {x:point.clientX,y:point.clientY} : null;
      }} onTouchCancel={() => { touch.current = null; }} onTouchEnd={event => {
        if (!touch.current || slides.length < 2) return;
        const dx = event.changedTouches[0].clientX - touch.current.x;
        const dy = event.changedTouches[0].clientY - touch.current.y;
        touch.current = null;
        if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy)*1.4) return;
        swiped.current = true;
        setIndex((active + (dx < 0 ? 1 : -1) + slides.length) % slides.length);
      }} onClickCapture={event => {
        if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false; }
      }}>
        <Link href={`/product/${current.slug}`} aria-label={`Рассмотреть объект «${current.title}»`}>
          <Photo key={current.slug} photo={current.media[0]} priority={active === 0} sizes="(max-width: 760px) 100vw, 55vw" />
        </Link>
        <span className="store-object-label">{statusLabel(current)}</span>
      </div>
      <div className="store-hero-caption">
        <Link href={`/product/${current.slug}`}>{current.title}</Link>
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
    <Link className="store-primary-link home-hero-cta" href="/catalog">Смотреть коллекцию</Link>
  </section>;
}
