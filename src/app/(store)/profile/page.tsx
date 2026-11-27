import { loadCatalog } from "@/features/store/catalog-data";
import { ProfilePage } from "@/features/store/SavedPages";

export default async function Page() {
  return <ProfilePage products={await loadCatalog()} />;
}
