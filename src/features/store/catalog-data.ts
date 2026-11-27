import "server-only";
import { createCatalogClient } from "@/lib/supabase/public";
import { toProduct, type CatalogRecord } from "./catalog-record";
import type { Product } from "./products";

export function isDemoCatalog() {
  return process.env.ROOMLET_DEMO_MODE === "true";
}

export async function loadCatalog({ slug, limit }: { slug?: string; limit?: number } = {}): Promise<Product[]> {
  if (isDemoCatalog()) {
    const { demoProducts } = await import("./demo-products");
    const rows = slug === undefined ? demoProducts : demoProducts.filter(item => item.slug === slug);
    return limit === undefined ? rows : rows.slice(0, limit);
  }
  const client = await createCatalogClient();
  const products: Product[] = [];
  const batchSize = Math.min(limit ?? 100, 100);
  for (let from = 0; ; from += batchSize) {
    let query = client.rpc("roomlet_catalog");
    if (slug !== undefined) query = query.eq("slug", slug);
    const { data, error } = await query.range(from, from + batchSize - 1);
    if (error) throw new Error("Не удалось загрузить каталог из мастерской.");
    const rows = (data ?? []) as CatalogRecord[];
    products.push(...rows.map(toProduct));
    if (rows.length < batchSize || limit !== undefined || slug !== undefined) return products;
  }
}
