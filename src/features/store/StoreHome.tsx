import Link from "next/link";
import { ArrowRight, ArrowUpRight, PencilRuler } from "lucide-react";
import { FeaturedObject } from "./FeaturedObject";
import { ProductCard } from "./ProductCard";
import { products } from "./products";

export function StoreHome() {
  return <>
    <FeaturedObject />
    <section className="store-section"><div className="store-section-head"><h2>Новые работы</h2><Link href="/catalog">Весь каталог <ArrowRight size={16} /></Link></div>
      <div className="store-grid">{products.slice(0, 3).map(product => <ProductCard key={product.slug} product={product} />)}</div>
    </section>
    <section className="store-section"><div className="store-section-head"><h2>Коллекции</h2></div>
      <div className="store-directory">
        {[["Доступные изделия", "ready"], ["Будущие коллекции", "upcoming"], ["Архив работ", "archive"]].map(([title, availability]) =>
          <Link key={availability} href={`/catalog?availability=${availability}`}>{title}<ArrowUpRight size={22} /></Link>)}
      </div>
    </section>
    <section className="store-custom-banner"><PencilRuler aria-hidden="true" size={34} strokeWidth={1.3} /><div><h2>Индивидуальный проект</h2><p>Опишите интерьер, который хотите увидеть в миниатюре.</p></div><Link href="/custom">Описать идею <ArrowRight size={18} /></Link></section>
  </>;
}
