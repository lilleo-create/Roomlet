import type { Product } from "./products";

const fixtures = [
  {
    slug: "atelier", number: "001", title: "Библиотека-ротонда", category: "Библиотеки",
    image: "/objects/atelier.webp", alt: "Английская библиотека в круглой ротонде эпохи Регентства, миниатюра Торн",
    description: "Английская библиотека эпохи Регентства. Круглая ротонда задаёт композицию интерьера 1810–1820-х годов.",
    material: "Дерево, бумага, ткань", scale: "1:12", price: 12800,
    ready: true, made: true, status: "active" as const,
  },
  {
    slug: "reading", number: "002", title: "Гостиная шейкеров", category: "Гостиные",
    image: "/objects/reading.webp", alt: "Гостиная американской общины шейкеров около 1800 года, миниатюра Торн",
    description: "Гостиная американской общины шейкеров около 1800 года. Лаконичная мебель и строгие линии раскрывают характер комнаты.",
    material: "Дерево, картон, металл", scale: "1:12", price: 14600,
    ready: false, made: true, status: "active" as const,
  },
  {
    slug: "ceramics", number: "003", title: "Ванная с будуаром", category: "Будуары",
    image: "/objects/ceramics.webp", alt: "Французская ванная с будуаром конца XVIII века, миниатюра Торн",
    description: "Французский интерьер переходной эпохи, 1793–1804. В одной миниатюре соединены ванная комната и будуар.",
    material: "Дерево, бумага", scale: "1:12", price: 11900,
    ready: false, made: false, status: "upcoming" as const,
  },
  {
    slug: "greenhouse", number: "004", title: "Будуар Людовика XV", category: "Будуары",
    image: "/objects/greenhouse.webp", alt: "Французский будуар эпохи Людовика XV, миниатюра Торн",
    description: "Французский будуар 1740–1760-х годов. Небольшой личный интерьер передаёт камерность эпохи Людовика XV.",
    material: "Дерево, стекло", scale: "1:12", price: 15800,
    ready: false, made: false, status: "archive" as const,
  },
];

export const demoProducts: Product[] = fixtures.map(({ image, alt, price, ...fields }) => ({
  ...fields, media: [{ src: image, alt }], priceMinor: price * 100, currency: "RUB",
  dimensions: "", requiresSketch: false,
}));
