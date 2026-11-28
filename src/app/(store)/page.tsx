import { StoreHome } from "@/features/store/StoreHome";
import { LaunchReady } from "@/features/launch/LaunchProvider";
import { ViewEvent } from "@/features/store/ViewEvent";
import { loadCatalog, isDemoCatalog } from "@/features/store/catalog-data";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ composition?: string }> }) {
  const [products, options] = await Promise.all([loadCatalog(), searchParams]);
  return <><ViewEvent name="home_view" /><StoreHome demo={(await isDemoCatalog())} products={products}
    composition={options.composition === "b" ? "b" : "a"} /><LaunchReady waitForHero /></>;
}
