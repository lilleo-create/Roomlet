"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeading, EmptyState } from "@/components/ui";
import { ProductCard } from "./ProductCard";
import type { Product } from "./products";
import { useStore } from "./StoreProvider";

export function FavoritesPage({products}: {products: Product[]}) {
  const { favorites } = useStore();
  const visible = products.filter(p => favorites.includes(p.slug));
  return <section className="store-page"><PageHeading title="Избранное" />
    {visible.length ? <div className="store-grid">{visible.map(p => <ProductCard key={p.slug} product={p} />)}</div>
    : <EmptyState variant="favorites" title="Здесь будут ваши любимые миниатюры" description="Нажмите на сердце у изделия, чтобы сохранить его." action={<Link href="/catalog" className="store-primary-link">В каталог <ArrowRight size={18} /></Link>} />}
  </section>;
}
