import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireDemo } from "@/features/studio/session";
import { StudioShell } from "@/features/studio/Shell";
import { products } from "@/features/store/products";

export default async function StudioProductsPage() {
  await requireDemo("products");
  return <StudioShell active="products"><p className="rs-cap">Мастерская</p><div className="rs-page-title"><h1>Изделия</h1><span className="rs-demo">Деморежим</span></div>
    <div className="rs-products">{products.map((p) => <Link key={p.slug} href={"/product/" + p.slug}><span>№ {p.number}</span><div><strong>{p.title}</strong><p>{p.category}</p></div><ArrowUpRight aria-hidden="true" size={20}/></Link>)}</div>
  </StudioShell>;
}
