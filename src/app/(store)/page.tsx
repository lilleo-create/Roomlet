import { StoreHome } from "@/features/store/StoreHome";
import { ViewEvent } from "@/features/store/ViewEvent";

import { loadCatalog, isDemoCatalog } from "@/features/store/catalog-data";

export default async function HomePage() {
  return <><ViewEvent name="home_view" /><StoreHome demo={isDemoCatalog()} products={await loadCatalog({ limit: 4 })} /></>;
}
