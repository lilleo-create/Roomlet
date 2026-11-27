import Link from "next/link";
import { Photo } from "@/components/Photo";
import { FeaturedObject } from "./FeaturedObject";
import { WorkshopCarousel } from "./WorkshopCarousel";
import { availabilityOrder, type Product } from "./products";
import "./home.css";

const materials = {src:"/images/workshop-materials.webp", alt:"Оконная рама, шпон и кисть на столе мастера"};

export function StoreHome({ products, demo = false, composition = "a" }: {
  products: readonly Product[]; demo?: boolean; composition?: "a" | "b";
}) {
  const ordered = [...products].sort((a,b) => availabilityOrder(a) - availabilityOrder(b));
  return <div className={`home-composition composition-${composition}`}>
    <FeaturedObject products={ordered} />
    <nav className="home-collections" aria-label="Коллекции">
      <Link href="/catalog?availability=ready">В наличии</Link>
      <Link href="/catalog?availability=made">Под заказ</Link>
      <Link href="/catalog">Весь каталог</Link>
    </nav>
    {ordered.length > 0 && <WorkshopCarousel products={ordered} />}
    <section className="home-project">
      <div className="home-project-photo"><Photo photo={materials} sizes="(max-width: 760px) 95vw, 45vw" /></div>
      <div><h2>Индивидуальный проект</h2>
        <p>{demo ? "Воссоздадим в миниатюре комнату из вашей любимой истории." : "Миниатюра по вашей идее. Приём новых заявок пока закрыт."}</p>
        <Link href="/custom">{demo ? "Описать идею" : "Об индивидуальном заказе"}</Link>
      </div>
    </section>
    <Link className="home-archive" href="/catalog?availability=archive">Архив работ</Link>
  </div>;
}
