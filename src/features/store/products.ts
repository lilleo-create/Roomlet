export type Product = {
  id?: string;
  slug: string;
  demo?: boolean;
  number: string;
  title: string;
  category: string;
  media: { src: string; alt: string }[];
  currency: string;
  dimensions: string;
  requiresSketch: boolean;
  description: string;
  material: string;
  scale: string;
  priceMinor: number;
  ready: boolean;
  made: boolean;
  status: "active" | "upcoming" | "archive";
};

export const availabilityNames = {all: "Все", ready: "В наличии", made: "Под заказ", upcoming: "Скоро", archive: "Архив"} as const;
export type Availability = keyof typeof availabilityNames;

export function isAvailability(value?: string | null): value is Availability {
  return typeof value === "string" && Object.hasOwn(availabilityNames, value);
}

export function findProduct(products: readonly Product[], slug: string) {
  return products.find(product => product.slug === slug);
}

export function statusLabel(product: Product) {
  if (product.status === "upcoming") return availabilityNames.upcoming;
  if (product.status === "archive") return "Продан";
  if (product.ready) return availabilityNames.ready;
  return product.made ? availabilityNames.made : "Нет в наличии";
}

export function filterProducts(products: readonly Product[], query: string, category: string, availability: Availability) {
  const term = query.trim().toLocaleLowerCase("ru");
  return products.filter(product => {
    const text = [product.number, product.title, product.category].join(" ").toLocaleLowerCase("ru");
    return text.includes(term)
      && (!category || product.category === category)
      && (availability === "all" || (availability === "ready" && product.ready)
        || (availability === "made" && product.made) || product.status === availability);
  });
}

export function availabilityOrder(product: Product) {
  if (product.status === "active" && product.ready) return 0;
  if (product.status === "active" && product.made) return 1;
  return product.status === "upcoming" ? 2 : 3;
}
