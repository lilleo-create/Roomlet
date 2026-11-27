import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { FeaturedObject } from "./FeaturedObject";
import { ProductCard } from "./ProductCard";
import type { Product } from "./products";

const collections = [
  { title: "Готовые работы", detail: "Миниатюры в наличии", availability: "ready" },
  { title: "Сделаем на заказ", detail: "Изготовление по образцу", availability: "made" },
] as const;

export function StoreHome({ products, demo = false }: { products: readonly Product[]; demo?: boolean }) {
  return <>
    <FeaturedObject products={products} />
    <section className="store-section store-collections" aria-labelledby="home-collections">
      <div className="store-section-head">
        <h2 id="home-collections">Коллекции</h2>
        {demo && <div className="store-collection-links">
          <Link href="/catalog?availability=upcoming">Скоро</Link>
          <Link href="/catalog?availability=archive">Архив</Link>
        </div>}
      </div>
      <div className="store-directory">
        {collections.map(({ title, detail, availability }) =>
          <Link key={availability} href={`/catalog?availability=${availability}`}>
            <span className="store-directory-title">{title}</span>
            <ArrowUpRight size={18} aria-hidden />
            <span className="store-directory-detail">{detail}</span>
          </Link>)}
      </div>
    </section>
    {products.length > 0 && <section className="store-section" aria-labelledby="home-new-works">
      <div className="store-section-head"><h2 id="home-new-works">Новые работы</h2><Link href="/catalog">Весь каталог <ArrowRight size={16} aria-hidden /></Link></div>
      <div className="store-grid">{products.slice(0, 4).map(product => <ProductCard key={product.slug} product={product} />)}</div>
    </section>}
    <section className="store-custom-banner">
      <div><h2>Индивидуальный проект</h2>
        <p>{demo ? "Воссоздайте комнату из любимой истории или из собственных воспоминаний." : "Миниатюра по вашей идее. Приём новых заявок пока закрыт."}</p>
      </div>
      <Link href="/custom">{demo ? "Описать идею" : "Об индивидуальном заказе"} <ArrowRight size={18} aria-hidden /></Link>
    </section>
  </>;
}
