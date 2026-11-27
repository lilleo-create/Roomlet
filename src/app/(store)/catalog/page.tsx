import { Catalog } from "@/features/store/Catalog";
import { isAvailability } from "@/features/store/products";
import { ViewEvent } from "@/features/store/ViewEvent";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ availability?: string }> }) {
  const { availability } = await searchParams;
  return <><ViewEvent name="catalog_view" /><Catalog key={availability} initial={isAvailability(availability) ? availability : "all"} /></>;
}
