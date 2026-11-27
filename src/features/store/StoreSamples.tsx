"use client";
import { useState } from "react";
import { FilterBar } from "./Catalog";
import { FeaturedObject } from "./FeaturedObject";
import { ImageGallery } from "./ImageGallery";
import { AppHeader, BottomNav } from "./Navigation";
import { ProductCard } from "./ProductCard";
import type { Product, Availability } from "./products";
import { StoreProvider } from "./StoreProvider";
import "@/styles/store.css";

export function StoreSamples({products}: {products: Product[]}) {
  const [availability, setAvailability] = useState<Availability>("all");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  return <StoreProvider demo><div className="roomlet-store store-samples"><p>Демонстрационные изделия</p><AppHeader /><FeaturedObject products={products} heading="h3" />
    <FilterBar products={products} demo {...{ availability, category, query }} onAvailability={setAvailability} onCategory={setCategory} onQuery={setQuery} />
    <div className="store-sample-grid"><ProductCard product={products[0]} /><ImageGallery product={products[1]} /></div>
    <BottomNav inline /></div></StoreProvider>;
}
