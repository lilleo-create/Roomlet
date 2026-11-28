import { requireStaff } from "@/features/studio/session";
import { SplashComparison } from "./SplashComparison";
import "./preview.css";

export const metadata = { title: "Старт Roomlet — сравнение", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SplashComparisonPage() {
  if (process.env.NODE_ENV !== "development") await requireStaff("not-found");
  return <SplashComparison />;
}
