import { Catalog } from "@/features/store/Catalog";
import { isAvailability } from "@/features/store/products";
import { ViewEvent } from "@/features/store/ViewEvent";

import { loadCatalog, isDemoCatalog } from "@/features/store/catalog-data";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ availability?: string }> }) {
  const { availability } = await searchParams;
  return <><ViewEvent name="catalog_view" /><Catalog products={await loadCatalog()} demo={(await isDemoCatalog())} key={availability} initial={isAvailability(availability) ? availability : "all"} /></>;
}
