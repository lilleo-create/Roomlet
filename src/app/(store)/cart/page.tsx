import { loadCatalog, isDemoCatalog } from "@/features/store/catalog-data";
import { CartPage } from "@/features/store/Cart";

export default async function Page() {
  return <CartPage products={(await isDemoCatalog()) ? await loadCatalog() : []} />;
}
