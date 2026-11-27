import type { Metadata } from "next";
import { DesignSystem } from "./DesignSystem";
import "./samples.css";

export const metadata: Metadata = { title: "Дизайн-система" };
import { isDemoCatalog } from "@/features/store/catalog-data";
import { StoreSamples } from "@/features/store/StoreSamples";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function DesignSystemPage() {
  const samples = isDemoCatalog() ? <StoreSamples products={(await import("@/features/store/demo-products")).demoProducts} /> : <Link href="/catalog">Открыть каталог мастерской</Link>;
  return <DesignSystem storeSamples={samples} />;
}
