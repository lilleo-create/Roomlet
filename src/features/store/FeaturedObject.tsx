import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Photo } from "@/components/Photo";
import { statusLabel, type Product } from "./products";

export function FeaturedObject({ heading: Heading = "h1", products, subtitle }: { heading?: "h1" | "h3"; products: readonly Product[]; subtitle?: string }) {
  const featured = products[0];
  return <section className="store-hero" aria-label="Мастерская миниатюр">
    <div className="store-hero-copy">
      <Heading className="store-hero-title">Комнаты <span className="store-hero-line">в миниатюре<span className="store-hero-dot">.</span></span></Heading>
      {subtitle && <p className="home-subtitle">{subtitle}</p>}
    </div>
    <figure className="store-hero-piece">
      {featured ? <Link className="featured-link" href={`/product/${featured.slug}`}>
        <div className="store-hero-photo">
          <Photo photo={featured.media[0]} priority sizes="(max-width:760px) 100vw, 55vw" />
          <span className="store-object-label">{statusLabel(featured)}</span>
        </div>
        <div className="store-hero-caption">{featured.title}<ArrowUpRight size={18} aria-hidden /></div>
      </Link> : <><div className="store-hero-photo"><Photo photo={{src:"/images/workshop-materials.webp",alt:"Материалы на столе мастера"}} priority sizes="(max-width:760px) 100vw, 55vw" /></div><figcaption>Готовим новые миниатюры</figcaption></>}
    </figure>
  </section>;
}
