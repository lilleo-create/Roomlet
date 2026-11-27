import { notFound } from "next/navigation";
import { ProductDetail } from "@/features/store/ProductDetail";
import { findProduct, products } from "@/features/store/products";
import { ViewEvent } from "@/features/store/ViewEvent";

export function generateStaticParams() {
  return products.map(({ slug }) => ({ slug }));
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = findProduct(slug);
  if (!product) notFound();
  return <><ViewEvent name="product_view" slug={slug} /><ProductDetail key={slug} product={product} /></>;
}
