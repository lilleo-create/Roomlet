import "server-only";
import { requireAccountStaff, wantsShowcase } from "@/features/studio/session";
import { createCatalogClient } from "@/lib/supabase/public";
import { toProduct, type CatalogRecord } from "./catalog-record";
import type { Product } from "./products";
import { localDemoEnabled } from "@/lib/supabase/config";

export async function isDemoCatalog() {
  if (localDemoEnabled()) return true;
  if (!await wantsShowcase()) return false;
  await requireAccountStaff();
  return true;
}

export async function loadCatalog({ slug, limit }: { slug?: string; limit?: number } = {}): Promise<Product[]> {
  const client = await createCatalogClient();
  const demo = await isDemoCatalog();
  const products: Product[] = [];
  const batchSize = Math.min(limit ?? 100, 100);
  for (let from = 0; ; from += batchSize) {
    let query = client.rpc("roomlet_catalog");
    if (slug !== undefined) query = query.eq("slug", slug);
    const { data, error } = await query.range(from, from + batchSize - 1);
    if (error) throw new Error("Не удалось загрузить каталог из мастерской.");
    const rows = (data ?? []) as CatalogRecord[];
    products.push(...rows.filter(row => !row.is_demo || demo).map(toProduct));
    if (rows.length < batchSize || limit !== undefined || slug !== undefined) return products;
  }
}
