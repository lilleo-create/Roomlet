import { test, expect } from "@playwright/test";

test("поиск, фильтр доступности и избранное работают после переходов и перезагрузки", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "В каталог", exact: true }).click();
  await page.getByRole("button", { name: "Под заказ", exact: true }).click();
  await expect(page.locator(".store-card")).toHaveCount(2);
  await page.getByRole("searchbox", { name: "Поиск" }).fill("РоТоНдА");
  await expect(page.locator(".store-card")).toHaveCount(1);
  await page.getByRole("button", { name: "В избранное: Библиотека-ротонда" }).click();
  await page.getByRole("link", { name: "Избранное", exact: true }).click();
  await page.reload();
  await page.getByRole("link", { name: "Библиотека-ротонда", exact: true }).click();
  await page.getByRole("button", { name: "Фрагмент", exact: true }).click();
  await page.getByRole("button", { name: "Увеличить фотографию" }).click();
  const zoom = page.getByRole("dialog", { name: "Библиотека-ротонда" });
  await expect(zoom).toBeVisible();
  await expect(zoom.getByRole("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(zoom).toHaveCount(0);
  await page.getByRole("button", { name: "Удалить из избранного: Библиотека-ротонда" }).click();
  await page.getByRole("link", { name: "Избранное", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Соберите свою подборку" })).toBeVisible();
});

test("на узком телефоне главный объект виден до прокрутки", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  const photo = page.locator(".store-hero-photo img");
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const box = (await photo.boundingBox())!;
  const navTop = (await page.locator(".store-bottom-nav").boundingBox())!.y;
  expect(box.y).toBeGreaterThan(0);
  expect(Math.min(navTop - box.y, box.height)).toBeGreaterThan(box.height * 0.7);
  await page.getByRole("button", { name: "Следующий объект" }).click();
  await expect(page.locator(".store-hero-caption a")).toHaveText("Гостиная шейкеров");
});
