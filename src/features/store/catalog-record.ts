import type { Product } from "./products";

export interface CatalogRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  category_name: string | null;
  catalog_stage?: "active" | "upcoming" | "sold";
  is_demo?: boolean;
  dimensions: string | null;
  materials: string | null;
  currency: string;
  price_minor: number;
  ready_quantity: number;
  made_to_order: boolean;
  requires_sketch: boolean;
  media: { storage_path: string; alt_text: string | null; sort_order: number }[];
}

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const storagePath = new RegExp(`^${uuid}/${uuid}\\.webp$`, "i");

export function isCatalogPhotoPath(path: string) {
  return storagePath.test(path);
}

export function toProduct(row: CatalogRecord): Product {
  const media = row.media.filter(item => isCatalogPhotoPath(item.storage_path) && item.storage_path.startsWith(row.id + "/"));
  return {
    slug: row.slug, number: row.id.slice(0, 8).toUpperCase(), title: row.title,
    description: row.description, category: row.category_name || "Без категории",
    media: [...media].sort((a, b) => a.sort_order - b.sort_order).map(item => ({
      src: "/catalog-media/" + item.storage_path, alt: item.alt_text || row.title,
    })),
    dimensions: row.dimensions || "", material: row.materials || "", scale: "",
    priceMinor: row.price_minor, currency: row.currency,
    ready: row.ready_quantity > 0, made: row.made_to_order, requiresSketch: row.requires_sketch,
    status: row.catalog_stage === "upcoming" ? "upcoming" : row.catalog_stage === "sold" ? "archive" : "active",
    demo: row.is_demo === true,
  };
}
