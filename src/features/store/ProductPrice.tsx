import type { Product } from "./products";

export function ProductPrice({ product }: { product: Pick<Product, "currency" | "priceMinor"> }) {
  const format = new Intl.NumberFormat("ru-RU", { currency: product.currency, style: "currency", minimumFractionDigits: 0 });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return <span className="ui-price">{format.format(product.priceMinor / 10 ** digits)}</span>;
}
