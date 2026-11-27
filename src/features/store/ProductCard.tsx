"use client";

import Link from "next/link";
import { Photo } from "@/components/Photo";
import { ProductPrice } from "./ProductPrice";
import { ArrowUpRight, Heart } from "lucide-react";
import { IconButton, StatusTag } from "@/components/ui";
import { track } from "@/lib/analytics";
import { type Product, statusLabel } from "./products";
import { useStore } from "./StoreProvider";

export function FavoriteButton({ product }: { product: Product }) {
  const { favorites, toggleFavorite } = useStore();
  const saved = favorites.includes(product.slug);
  return <IconButton className="store-heart" label={`${saved ? "Удалить из избранного" : "В избранное"}: ${product.title}`} aria-pressed={saved}
    onClick={() => { toggleFavorite(product.slug); track(saved ? "favorite_remove" : "favorite_add", { product: product.slug }); }}>
    <Heart size={17} fill={saved ? "currentColor" : "none"} />
  </IconButton>;
}

export function ProductStatus({ product }: { product: Product }) {
  const tone = product.status === "upcoming" || (!product.ready && product.made) ? "primary" : product.ready ? "success" : "neutral";
  return <span className="store-product-status">
    <StatusTag tone={tone}>{statusLabel(product)}</StatusTag>
    {product.status === "active" && product.ready && product.made && <StatusTag tone="primary">Под заказ</StatusTag>}
  </span>;
}

export function ProductCard({ product }: { product: Product }) {
  const href = `/product/${product.slug}`;
  return <article className="store-card">
    <div className="store-card-visual">
      <Photo photo={product.media[0]} sizes="(max-width: 355px) 100vw, (max-width: 960px) 48vw, (max-width: 1199px) 32vw, 25vw" />
      <FavoriteButton product={product} />
    </div>
    <div className="store-card-meta"><ProductStatus product={product} /></div>
    <h3><Link href={href}>{product.title}</Link></h3>
    <div className="store-card-foot"><ProductPrice product={product} /><ArrowUpRight size={18} aria-hidden /></div>
  </article>;
}
