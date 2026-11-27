import { expect, test } from "@playwright/test";

test("блокировка даты в Studio отменяет доступность окна до оформления", async ({ page, context }) => {
  await page.goto("/product/atelier");
  await page.getByRole("radio", {name: "Изготовление под заказ"}).check();
  const add = page.getByRole("button", {name: "В корзину", exact: true});
  await expect(add).toBeDisabled();
  const first = page.getByRole("button", {name: /Можно выбрать начало/}).first();
  const label = (await first.getAttribute("aria-label"))!.split(",")[0];
  await first.click();
  await add.click();
  await page.getByRole("link", {name: /В корзине/}).click();
  const studio = await context.newPage();
  await studio.goto("/studio/calendar");
  await studio.getByRole("button", {name: /Открыть демо/}).click();
  const day = studio.getByRole("button", {name: label + ", Есть свободное время", exact: true});
  if (await day.count() === 0) await studio.getByRole("button", {name: "Следующий период"}).click();
  await day.click();
  await studio.getByRole("button", {name: "Закрыть дату"}).click();
  await expect(studio.getByRole("button", {name: "Снять блокировку"})).toBeVisible();
  await page.getByRole("button", {name: /Оформить заявку/}).click();
  await page.getByLabel("Контакт").fill("Демо");
  await page.getByRole("button", {name: /Сохранить демо-заявку/}).click();
  await expect(page.getByRole("alert")).toContainText("недоступно");
});

test("готовый экземпляр сохраняется в профиле без события покупки", async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener("roomlet:analytics", ev => {
      const name = (ev as CustomEvent).detail.event;
      sessionStorage.setItem("observed-events", (sessionStorage.getItem("observed-events") || "") + " " + name);
    });
  });
  await page.goto("/product/atelier");
  await page.getByRole("button", {name: "В корзину", exact: true}).click();
  await page.getByRole("link", {name: /В корзине/}).click();
  await page.getByRole("button", {name: /Оформить заявку/}).click();
  await page.getByLabel("Контакт").fill("Демо");
  await page.getByRole("button", {name: /Сохранить демо-заявку/}).click();
  await expect(page.getByRole("heading", {name: "Демо-заявка сохранена"})).toBeVisible();
  await page.getByRole("link", {name: "Открыть профиль"}).click();
  await expect(page.getByText("Библиотека-ротонда").first()).toBeVisible();
  const observed = await page.evaluate(() => sessionStorage.getItem("observed-events"));
  expect(observed).toContain("order_created");
  expect(observed).not.toContain("purchase");
});
