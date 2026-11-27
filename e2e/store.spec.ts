import { expect, test, type Page } from "@playwright/test";

const release = [
  { name: "Ночная библиотека", slug: "night-library", status: "В наличии", price: /6\s?500\s?₽/ },
  { name: "Токийское кафе", slug: "tokyo-cafe", status: "Под заказ", price: /5\s?900\s?₽/ },
  { name: "Оранжерея", slug: "greenhouse", status: "Скоро", price: /7\s?900\s?₽/ },
  { name: "Ателье художника", slug: "artist-atelier", status: "Продан", price: /8\s?500\s?₽/ },
];

async function openDemo(page: Page, path: string) {
  await page.goto(path);
  test.skip(!(await page.locator(".store-demo-label").count()), "Тест предназначен для демонстрационного каталога.");
}

test("четыре изделия загружаются из каталога вместе с ценами и изображениями", async ({ page }) => {
  await openDemo(page, "/catalog");
  for (const product of release) {
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: product.name, exact: true }) });
    await expect(card.getByRole("link", { name: product.name, exact: true })).toHaveAttribute("href", "/product/" + product.slug);
    await expect(card).toContainText(product.price);
    await expect(card.getByText(product.status, { exact: true })).toBeVisible();
    const photo = card.locator("img");
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(photo).toHaveAttribute("src", /\/catalog-media\//);
  }
});

test("поиск, фильтр доступности и избранное работают после перехода и перезагрузки", async ({ page }) => {
  await openDemo(page, "/catalog");
  await page.getByRole("button", { name: "Под заказ", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Поиск" });
  await search.fill("ТоКиЙсКоЕ");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "В избранное: Токийское кафе", exact: true }).click();
  await page.getByRole("link", { name: "Избранное", exact: true }).click();
  await page.reload();
  await page.getByRole("link", { name: "Токийское кафе", exact: true }).click();
  const galleryPhoto = page.getByRole("button", { name: "Увеличить фотографию" }).getByRole("img");
  const cover = await galleryPhoto.getAttribute("src");
  const coverAlt = await galleryPhoto.getAttribute("alt");
  await page.getByRole("button", { name: "Фото 2", exact: true }).click();
  await expect(galleryPhoto).not.toHaveAttribute("src", cover!);
  await expect(galleryPhoto).not.toHaveAttribute("alt", coverAlt!);
  await expect.poll(() => galleryPhoto.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Увеличить фотографию" }).click();
  const zoom = page.getByRole("dialog", { name: "Токийское кафе" });
  await expect(zoom.getByRole("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(zoom).toHaveCount(0);
  await page.getByRole("button", { name: "Удалить из избранного: Токийское кафе", exact: true }).click();
  await page.getByRole("link", { name: "Избранное", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Здесь будут ваши любимые миниатюры" })).toBeVisible();
});

test("на узком телефоне главный объект виден до прокрутки и карусель переключается", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openDemo(page, "/");
  const photo = page.locator(".store-hero-photo img");
  await expect.poll(() => photo.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const box = (await photo.boundingBox())!;
  const nav = (await page.locator(".store-bottom-nav").boundingBox())!;
  expect(box.y).toBeGreaterThan(0);
  expect(Math.min(nav.y - box.y, box.height)).toBeGreaterThan(box.height * 0.7);
  const caption = page.locator(".store-hero-caption a");
  const first = await caption.getAttribute("href");
  await page.getByRole("button", { name: "Следующий объект" }).click();
  await expect(caption).not.toHaveAttribute("href", first!);
  await page.getByRole("button", { name: "Предыдущий объект" }).click();
  await expect(caption).toHaveAttribute("href", first!);
});

test("карточка остаётся читаемой при недоступной фотографии", async ({ page }) => {
  await page.route("**/catalog-media/**", route => route.fulfill({ status: 404, body: "" }));
  await openDemo(page, "/product/night-library");
  await expect(page.getByRole("heading", { name: "Ночная библиотека", exact: true })).toBeVisible();
  await expect(page.getByText("Фото недоступно", { exact: true })).toBeVisible();
});

test("публичные страницы не содержат ссылок в Studio и библиотеку компонентов", async ({ page }) => {
  for (const path of ["/", "/catalog", "/profile", "/favorites", "/cart"]) {
    await page.goto(path);
    await expect(page.locator('a[href^="/studio"], a[href^="/design-system"]')).toHaveCount(0);
    await expect(page.locator('img[src*="/objects/"]')).toHaveCount(0);
  }
});
