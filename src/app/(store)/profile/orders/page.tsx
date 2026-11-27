import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { OrderHistory } from "@/features/profile/OrderHistory";
import { isDemoCatalog, loadCatalog } from "@/features/store/catalog-data";

export default async function ProfileOrders() {
  const demo = isDemoCatalog();
  return <section className="store-page store-narrow profile-subpage">
    <Link href="/profile" className="store-back"><ArrowLeft size={16} aria-hidden /> Мой профиль</Link>
    <PageHeading title="Мои заказы" description={demo ? "Демонстрационные заявки с этого устройства." : undefined} />
    <OrderHistory products={demo ? await loadCatalog() : []} />
  </section>;
}
