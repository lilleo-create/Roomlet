"use client";

import { useMemo, useState } from "react";
import { Photo } from "@/components/Photo";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui";
import type { Product } from "./products";

function availabilityOrder(product: Product) {
  if (product.ready) return 0;
  if (product.made) return 1;
  return product.status === "upcoming" ? 2 : 3;
}

export function FeaturedObject({ heading: Heading = "h1", products }: { heading?: "h1" | "h3"; products: readonly Product[] }) {
  const [index, setIndex] = useState(0);
  const slides = useMemo(() => [...products].sort((a, b) => availabilityOrder(a) - availabilityOrder(b)), [products]);
  const current = slides[index % slides.length];
  if (!current) return null;
  return <section className="store-hero" aria-label="Главный объект коллекции">
    <div className="store-hero-copy">
      <Heading className="store-hero-title">Интерьеры<br />в миниатюре<span>.</span></Heading>
      <p>Коллекционные комнаты и румбоксы ручной работы.</p>
      <Link className="store-primary-link" href="/catalog">В каталог <ArrowRight size={19} /></Link>
    </div>
    <div className="store-hero-piece">
      <div className="store-hero-photo">
        <Link href={`/product/${current.slug}`} aria-label={`Рассмотреть объект «${current.title}»`}>
          <Photo key={current.slug} photo={current.media[0]} priority={index === 0} sizes="(max-width: 760px) 100vw, 59vw" />
        </Link>
        <span className="store-object-label">{current.category}</span>
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
