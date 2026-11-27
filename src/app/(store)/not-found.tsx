import Link from "next/link";
import { EmptyState } from "@/components/ui";
export default function MissingProduct() {
  return <section className="store-page"><EmptyState title="Изделие недоступно" description="Здесь больше нет опубликованного изделия."
    action={<Link className="store-primary-link" href="/catalog">В каталог</Link>} /></section>;
}
