import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/features/studio/session";
import { isDemoCatalog, loadCatalog } from "@/features/store/catalog-data";
import { StoreSamples } from "@/features/store/StoreSamples";
import { DesignSystem } from "./DesignSystem";
import "./samples.css";

export const metadata: Metadata = { title: "Дизайн-система", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DesignSystemPage() {
  await requireStaff("not-found");
  const products = isDemoCatalog() ? await loadCatalog({ limit: 4 }) : [];
  const samples = products.length >= 2
    ? <StoreSamples products={products} />
    : <Link href="/catalog">Открыть каталог мастерской</Link>;
  return <DesignSystem storeSamples={samples} />;
}
