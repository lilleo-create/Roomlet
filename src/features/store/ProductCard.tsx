"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import { IconButton, ObjectNumber, Price, StatusTag } from "@/components/ui";
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

export function ProductCard({ product }: { product: Product }) {
  const href = `/product/${product.slug}`;
  return <article className="store-card">
    <div className="store-card-visual">
      <Link href={href} tabIndex={-1} aria-hidden="true">
        <Image src={product.image} alt="" fill sizes="(max-width: 680px) 48vw, 32vw" />
      </Link>
      <FavoriteButton product={product} />
    </div>
    <div className="store-card-meta"><ObjectNumber value={product.number} /><StatusTag tone={product.ready ? "success" : "neutral"}>{statusLabel(product)}</StatusTag></div>
    <h3><Link href={href}>{product.title}</Link></h3>
    {product.status === "active" ? <Price value={product.price} /> : <span className="store-small">{product.category}</span>}
  </article>;
}
