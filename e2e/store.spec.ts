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
  await expect(page.locator(".featured-link")).toHaveAttribute("href","/product/night-library");
  await expect(page.getByRole("button",{name:"Следующий объект"})).toHaveCount(0);

  const workshop = page.getByRole("group", { name: "Работы мастерской" });
  const slides = workshop.locator("[data-work]");
  const ids = await slides.evaluateAll(items => items.map(item => item.getAttribute("data-work")));
  expect(new Set(ids).size).toBe(ids.length);
  const leading = () => slides.evaluateAll(items => {
    if (!items.length) return null;
    const left = items[0].parentElement!.getBoundingClientRect().left;
    return items.find(item => Math.abs(item.getBoundingClientRect().left - left) < 1)?.getAttribute("data-work");
  });
  await workshop.press("ArrowLeft");
  await expect.poll(leading).toBe(ids.at(-1));
  await workshop.press("ArrowRight");
  await expect.poll(leading).toBe(ids[0]);

  // Chromium touch input exercises the same drag recognizer as a phone.
  const cdp = await page.context().newCDPSession(page);
  await workshop.scrollIntoViewIfNeeded();
  const rect = (await workshop.boundingBox())!;
  const y = Math.round(rect.y + 55);
  const x = Math.round(rect.x + rect.width * 0.65);
  const distance = Math.round(rect.width * 0.52);
  await cdp.send("Input.dispatchTouchEvent", { type:"touchStart", touchPoints:[{x,y}] });
  for (let step = 1; step <= 8; step++) {
    await cdp.send("Input.dispatchTouchEvent", { type:"touchMove", touchPoints:[{x:x-distance*step/8,y}] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type:"touchEnd", touchPoints:[] });
  await cdp.detach();
  await expect.poll(leading).toBe(ids[1]);
  await expect(page).toHaveURL(/\/$/);
  await slides.nth(1).getByRole("link").click();
  await expect(page).toHaveURL(/\/product\//);
  await page.goBack();
  await expect.poll(leading).toBe(ids[1]);
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

test("мобильная лента фильтров прокручивается в одну строку и открывает нужные работы", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openDemo(page, "/");
  await page.getByRole("link", { name: "Под заказ", exact: true }).click();
  const rail = page.getByRole("group", { name: "Доступность" });
  await expect(rail.getByRole("button", { name: "Под заказ" })).toHaveAttribute("aria-pressed", "true");
  const geometry = await rail.evaluate(row => ({
    rows: new Set([...row.querySelectorAll("button")].map(button => button.offsetTop)).size,
    scrolls: row.scrollWidth > row.clientWidth,
  }));
  expect(geometry).toEqual({ rows: 1, scrolls: true });
  await page.goto("/catalog?availability=archive");
  const archive = rail.getByRole("button", { name: "Архив" });
  await expect(archive).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => rail.evaluate(row => row.scrollLeft)).toBeGreaterThan(0);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Ателье художника");
});
