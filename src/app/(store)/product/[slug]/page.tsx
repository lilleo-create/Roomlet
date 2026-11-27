import { notFound } from "next/navigation";
import { ProductDetail } from "@/features/store/ProductDetail";
import { loadCatalog } from "@/features/store/catalog-data";
import { ViewEvent } from "@/features/store/ViewEvent";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product] = await loadCatalog({ slug, limit: 1 });
  if (!product) notFound();
  return <><ViewEvent name="product_view" slug={slug} /><ProductDetail key={slug} product={product} /></>;
}
