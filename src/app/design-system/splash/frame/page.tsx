import { requireStaff } from "@/features/studio/session";
import { loadCatalog } from "@/features/store/catalog-data";
import { StoreHome } from "@/features/store/StoreHome";
import { StoreProvider } from "@/features/store/StoreProvider";
import { AppHeader, BottomNav } from "@/features/store/Navigation";
import { SplashPreview } from "./SplashPreview";
import "@/styles/store.css";
import "../preview.css";

export const metadata = { title: "Превью заставки", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SplashFrame({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV !== "development") await requireStaff("not-found");
  const options = await searchParams;
  const products = await loadCatalog();
  const delay = ["3500", "10000"].includes(options.delay ?? "") ? Number(options.delay) : 0;
  const still = ["300", "880", "1180"].includes(options.still ?? "") ? Number(options.still) : undefined;
  return <SplashPreview variant={options.variant === "expressive" ? "expressive" : "calm"}
    delay={delay} reducedMotion={options.reduced === "true"} still={still}>
    <StoreProvider demo={false}><div className="roomlet-store"><AppHeader />
      <main id="store-content" className="store-main"><StoreHome products={products} /></main><BottomNav />
    </div></StoreProvider>
  </SplashPreview>;
}
