import "server-only";
import { wantsShowcase } from "@/features/studio/session";
import { localDemoEnabled } from "@/lib/supabase/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { imageBucket, type InventoryItem, type ProductStatus, type Category } from "./model";

export async function formContext(db: SupabaseClient) {
  const [categories, settings] = await Promise.all([
    db.from("categories").select("id,name").order("name"),
    db.from("workshop_settings").select("currency").eq("id", 1).maybeSingle(),
  ]);
  if (categories.error || settings.error) throw new Error("Не удалось загрузить категории и настройки мастерской.");
  return { categories: (categories.data || []) as Category[], currency: String(settings.data?.currency || "RUB") };
}

export function newInventoryItem(currency: string): InventoryItem {
  const id = crypto.randomUUID();
  return {
    id, slug: "object-" + id, title: "", description: "", category_id: null,
    materials: "", dimensions: "", status: "draft", updated_at: null, price_minor: 0, cost_minor: 0,
    currency, planned_minutes: 0, ready_quantity: 0, made_to_order: false, requires_sketch: false, media: [],
  };
}

export async function loadInventoryItem(db: SupabaseClient, id: string): Promise<InventoryItem | null> {
  // Pin the version before fetching related rows. A concurrent edit then forces a fresh read on save.
  const product = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (product.error) throw new Error("Не удалось загрузить изделие.");
  if (!product.data) return null;
  const [offer, costs, media, units] = await Promise.all([
    db.from("product_offers").select("price_minor,currency,made_to_order,requires_sketch").eq("product_id", id).maybeSingle(),
    db.from("product_costs").select("cost_minor,planned_minutes").eq("product_id", id).maybeSingle(),
    db.from("product_media").select("storage_path,alt_text").eq("product_id", id).order("sort_order"),
    db.from("product_units").select("id", {count:"exact",head:true}).eq("product_id", id).eq("status","available"),
  ]);
  if ([offer,costs,media,units].some(result => result.error)) throw new Error("Не удалось загрузить изделие.");
  if (!offer.data || !costs.data) throw new Error("Данные изделия неполны. Проверьте состояние записи.");
  const rows = media.data || [];
  const paths = rows.map(row => row.storage_path);
  const local = localDemoEnabled() || await wantsShowcase();
  const urls = paths.length && !local ? await db.storage.from(imageBucket).createSignedUrls(paths, 3600) : null;
  if (urls?.error || urls?.data?.some(row => !row.signedUrl)) throw new Error("Не удалось загрузить фотографии изделия.");
  return {
    ...product.data, status: product.data.status as ProductStatus, ...offer.data, ...costs.data,
    ready_quantity: units.count ?? 0,
    media: rows.map((row, i) => ({...row, alt_text: row.alt_text || "", url: local ? "/studio/media/" + row.storage_path : urls?.data?.[i]?.signedUrl || ""})),
  };
}
