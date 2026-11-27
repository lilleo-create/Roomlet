"use client";
import { useState } from "react";
import { FilterBar } from "./Catalog";
import { FeaturedObject } from "./FeaturedObject";
import { ImageGallery } from "./ImageGallery";
import { AppHeader, BottomNav } from "./Navigation";
import { ProductCard } from "./ProductCard";
import { products, type Availability } from "./products";
import { StoreProvider } from "./StoreProvider";
import "@/styles/store.css";

export function StoreSamples() {
  const [availability, setAvailability] = useState<Availability>("all");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  return <StoreProvider><div className="roomlet-store store-samples"><AppHeader /><FeaturedObject heading="h3" />
    <FilterBar {...{ availability, category, query }} onAvailability={setAvailability} onCategory={setCategory} onQuery={setQuery} />
    <div className="store-sample-grid"><ProductCard product={products[0]} /><ImageGallery product={products[1]} /></div>
    <BottomNav inline /></div></StoreProvider>;
}
