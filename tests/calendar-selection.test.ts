import assert from "node:assert/strict";
import test from "node:test";
import { calendarKeyTarget, selectRange } from "../src/features/booking/selection.ts";

test("стрелки, Home и End пересекают границы месяцев и лет", () => {
  assert.equal(calendarKeyTarget("2026-12-31", "ArrowRight"), "2027-01-01");
  assert.equal(calendarKeyTarget("2027-01-01", "ArrowLeft"), "2026-12-31");
  assert.equal(calendarKeyTarget("2027-01-01", "Home"), "2026-12-28");
  assert.equal(calendarKeyTarget("2026-12-31", "End"), "2027-01-03");
  assert.equal(calendarKeyTarget("2027-01-01", "ArrowUp"), "2026-12-25");
  assert.equal(calendarKeyTarget("2026-12-25", "ArrowDown"), "2027-01-01");
  assert.equal(calendarKeyTarget("2026-12-25", "Enter"), undefined);
});

test("PageUp/PageDown сохраняют номер дня с учётом високосного февраля", () => {
  assert.equal(calendarKeyTarget("2024-01-31", "PageDown"), "2024-02-29");
  assert.equal(calendarKeyTarget("2025-03-31", "PageUp"), "2025-02-28");
  assert.equal(calendarKeyTarget("2026-12-31", "PageDown"), "2027-01-31");
});

test("диапазон включает оба конца, допускает обратный выбор и один день", () => {
  const start = selectRange({ start: null, end: null }, "2027-01-02");
  assert.deepEqual(start, { start: "2027-01-02", end: null });
  const earlier = selectRange(start, "2026-12-31");
  assert.deepEqual(earlier, { start: "2026-12-31", end: "2027-01-02" });
  assert.deepEqual(selectRange(start, "2027-01-02"), { start: "2027-01-02", end: "2027-01-02" });
  assert.deepEqual(selectRange(earlier, "2027-01-04"), { start: "2027-01-04", end: null });
});
