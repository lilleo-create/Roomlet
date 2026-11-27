import { loadCatalog } from "@/features/store/catalog-data";
import { FavoritesPage } from "@/features/store/SavedPages";

export default async function Page() {
  return <FavoritesPage products={await loadCatalog()} />;
}
