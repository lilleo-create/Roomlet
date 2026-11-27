import { PageHeading, Skeleton } from "@/components/ui";
export default function Loading() {
  return <section className="store-page" aria-busy="true" aria-label="Загрузка витрины">
    <PageHeading title="Коллекция" /><div className="store-grid">{[1, 2, 3, 4].map(n => <Skeleton key={n} className="store-loading-card"/>)}</div>
  </section>;
}
