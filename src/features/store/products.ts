export type Product = {
  slug: string;
  number: string;
  title: string;
  category: string;
  image: string;
  alt: string;
  description: string;
  material: string;
  scale: string;
  price: number;
  ready: boolean;
  made: boolean;
  status: "active" | "upcoming" | "archive";
};

export const products: readonly Product[] = [
  {
    slug: "atelier", number: "001", title: "Библиотека-ротонда", category: "Библиотеки",
    image: "/objects/atelier.webp", alt: "Английская библиотека в круглой ротонде эпохи Регентства, миниатюра Торн",
    description: "Английская библиотека эпохи Регентства. Круглая ротонда задаёт композицию интерьера 1810–1820-х годов.",
    material: "Дерево, бумага, ткань", scale: "1:12", price: 12800,
    ready: true, made: true, status: "active",
  },
  {
    slug: "reading", number: "002", title: "Гостиная шейкеров", category: "Гостиные",
    image: "/objects/reading.webp", alt: "Гостиная американской общины шейкеров около 1800 года, миниатюра Торн",
    description: "Гостиная американской общины шейкеров около 1800 года. Лаконичная мебель и строгие линии раскрывают характер комнаты.",
    material: "Дерево, картон, металл", scale: "1:12", price: 14600,
    ready: false, made: true, status: "active",
  },
  {
    slug: "ceramics", number: "003", title: "Ванная с будуаром", category: "Будуары",
    image: "/objects/ceramics.webp", alt: "Французская ванная с будуаром конца XVIII века, миниатюра Торн",
    description: "Французский интерьер переходной эпохи, 1793–1804. В одной миниатюре соединены ванная комната и будуар.",
    material: "Дерево, бумага", scale: "1:12", price: 11900,
    ready: false, made: false, status: "upcoming",
  },
  {
    slug: "greenhouse", number: "004", title: "Будуар Людовика XV", category: "Будуары",
    image: "/objects/greenhouse.webp", alt: "Французский будуар эпохи Людовика XV, миниатюра Торн",
    description: "Французский будуар 1740–1760-х годов. Небольшой личный интерьер передаёт камерность эпохи Людовика XV.",
    material: "Дерево, стекло", scale: "1:12", price: 15800,
    ready: false, made: false, status: "archive",
  },
];

export const availabilityNames = {all: "Все", ready: "В наличии", made: "Под заказ", upcoming: "Скоро", archive: "Архив"} as const;
export type Availability = keyof typeof availabilityNames;

export function isAvailability(value?: string | null): value is Availability {
  return typeof value === "string" && Object.hasOwn(availabilityNames, value);
}

export function findProduct(slug: string) {
  return products.find(product => product.slug === slug);
}

export function statusLabel(product: Product) {
  if (product.status === "upcoming") return availabilityNames.upcoming;
  if (product.status === "archive") return availabilityNames.archive;
  return product.ready ? availabilityNames.ready : availabilityNames.made;
}

export function filterProducts(query: string, category: string, availability: Availability) {
  const term = query.trim().toLocaleLowerCase("ru");
  return products.filter(product => {
    const text = [product.number, product.title, product.category].join(" ").toLocaleLowerCase("ru");
    return text.includes(term)
      && (!category || product.category === category)
      && (availability === "all" || (availability === "ready" && product.ready)
        || (availability === "made" && product.made) || product.status === availability);
  });
}
