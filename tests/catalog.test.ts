import assert from "node:assert/strict";
import test from "node:test";
import {filterProducts, findProduct, isAvailability} from "../src/features/store/products.ts";
import {isCatalogPhotoPath, toProduct, type CatalogRecord} from "../src/features/store/catalog-record.ts";
import {demoProducts} from "../src/features/store/demo-products.ts";

const id = "1553cc2d-9449-4f70-a30a-e7f8c8fe2a3f";
const jpg = "f9a16ef4-9bcc-46f8-a92f-de25ab5216b9.webp";
const record: CatalogRecord = {
  id, slug: "polka", title: "Полка", category_name: "Мебель", dimensions: "5 × 3 см",
  materials: "Берёза", description: "", price_minor: 1499, currency: "EUR",
  ready_quantity: 2, made_to_order: true, requires_sketch: true, media: [],
};

test("опубликованный объект одновременно попадает в обе доступные категории", () => {
  const product = toProduct(record);
  for (const mode of ["ready","made"] as const) {
    assert.equal(filterProducts([product], "  ПОЛ ", "Мебель", mode)[0]?.slug, "polka");
  }
  assert.deepEqual(filterProducts([product], "ПОЛ", "Другая категория", "all"), []);
  assert.equal(product.priceMinor,1499);
  assert.equal(product.currency,"EUR");
  assert.equal(findProduct([], "polka"),undefined);
});

test("порядок реальных фото сохраняется, посторонние пути не выдаются клиенту", () => {
  const other = "098c1016-3cdf-4c99-b883-d24530d1c3ae";
  const media = [
    {storage_path: id + "/" + jpg, alt_text: "Сбоку", sort_order: 1},
    {storage_path: other + "/" + jpg, alt_text: "Чужое фото", sort_order: 0},
    {storage_path: id + "/" + other + ".webp", alt_text: "Спереди", sort_order: 0},
  ];
  assert.deepEqual(toProduct({...record,media}).media.map(x => x.alt), ["Спереди","Сбоку"]);
  assert.equal(isCatalogPhotoPath(id+"/../"+jpg),false);
  assert.deepEqual(toProduct(record).media, []);
});

test("демо-данные сохраняют будущие и архивные модели отдельно от доступных", () => {
  for (const group of ["upcoming", "archive"] as const) {
    const models = filterProducts(demoProducts, "", "", group);
    assert.ok(models.length > 0 && models.every(x => !x.made && !x.ready));
  }
  assert.equal(isAvailability("constructor"), false);
});
