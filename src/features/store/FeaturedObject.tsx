"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui";
import { products } from "./products";

export function FeaturedObject({ heading: Heading = "h1" }: { heading?: "h1" | "h3" }) {
  const [index, setIndex] = useState(0);
  const slides = products.filter(product => product.status !== "archive");
  const current = slides[index];
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
          <Image key={current.image} src={current.image} alt={current.alt} fill priority={index === 0} sizes="(max-width: 760px) 100vw, 59vw" />
        </Link>
        <span className="store-object-label">Объект № {current.number}</span>
      </div>
      <div className="store-hero-caption">
        <Link href={`/product/${current.slug}`}>{current.title} <ArrowRight size={17} /></Link>
        <div className="store-carousel-tools">
          <IconButton label="Предыдущий объект" onClick={() => setIndex((index + slides.length - 1) % slides.length)}><ChevronLeft size={17} /></IconButton>
          <span aria-live="polite">0{index + 1} / 0{slides.length}</span>
          <IconButton label="Следующий объект" onClick={() => setIndex((index + 1) % slides.length)}><ChevronRight size={17} /></IconButton>
        </div>
      </div>
    </div>
  </section>;
}
