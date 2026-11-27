"use client";

import { useState } from "react";
import { Photo } from "./Photo";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui";
import type { Product } from "./products";

export function FeaturedObject({ heading: Heading = "h1", products }: { heading?: "h1" | "h3"; products: readonly Product[] }) {
  const [index, setIndex] = useState(0);
  const slides = products.filter(product => product.status !== "archive");
  const current = slides[index % slides.length];
  if (!current) return null;
  return <section className="store-hero" aria-label="Главный объект коллекции">
    <div className="store-hero-copy">
      <span className="store-kicker"><i aria-hidden="true" />Коллекция Roomlet</span>
      <Heading className="store-hero-title">Интерьеры<br />в миниатюре<span>.</span></Heading>
      <p>Коллекционные комнаты и румбоксы.<br className="store-wide-break" /> В наличии и на заказ.</p>
      <Link className="store-primary-link" href="/catalog">В каталог <ArrowRight size={19} /></Link>
    </div>
    <div className="store-hero-piece">
      <div className="store-hero-photo">
        <Link href={`/product/${current.slug}`} aria-label={`Рассмотреть объект «${current.title}»`}>
          <Photo key={current.slug} photo={current.media[0]} priority={index === 0} sizes="(max-width: 760px) 100vw, 59vw" />
        </Link>
        <span className="store-object-label">Объект № {current.number}</span>
      </div>
      <div className="store-hero-caption">
        <Link href={`/product/${current.slug}`}>{current.title} <ArrowRight size={17} /></Link>
        {slides.length > 1 && <div className="store-carousel-tools">
          <IconButton label="Предыдущий объект" onClick={() => setIndex((index + slides.length - 1) % slides.length)}><ChevronLeft size={17} /></IconButton>
          <span aria-live="polite">{String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
          <IconButton label="Следующий объект" onClick={() => setIndex((index + 1) % slides.length)}><ChevronRight size={17} /></IconButton>
        </div>}
      </div>
    </div>
  </section>;
}
