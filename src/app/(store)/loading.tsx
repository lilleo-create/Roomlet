import { Skeleton } from "@/components/ui";
export default function Loading() {
  return <section className="store-page" aria-busy="true" aria-label="Загрузка витрины">
    <h1>Коллекция</h1><div className="store-grid">{[1, 2, 3].map(n => <Skeleton key={n} className="store-loading-card"/>)}</div>
  </section>;
}
