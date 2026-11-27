import assert from "node:assert/strict";
import test from "node:test";
import {filterProducts, findProduct, isAvailability} from "../src/features/store/products.ts";

test("готовый объект может одновременно предлагаться под заказ", () => {
  for (const mode of ["ready", "made"] as const) {
    assert.ok(filterProducts("  РОТОНДА ", "Библиотеки", mode).some(x => x.slug === "atelier"));
  }
  assert.deepEqual(filterProducts("001", "Будуары", "all"), []);
});
test("архивные и будущие модели исключены из вариантов покупки", () => {
  for (const group of ["upcoming", "archive"] as const) {
    const models = filterProducts("", "", group);
    assert.ok(models.length > 0);
    assert.ok(models.every(x => !x.made && !x.ready));
  }
  assert.equal(findProduct("missing"), undefined);
  assert.equal(isAvailability("constructor"), false);
});
