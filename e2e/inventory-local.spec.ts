import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { signInLocalMaker } from "./local-maker";

test("мастер открывает четыре демонстрационных изделия для редактирования", async ({ page, baseURL }) => {
  await page.goto("/");
  test.skip(!(await page.locator(".store-demo-label").count()), "Нужен каталог с демонстрационными данными.");
  await signInLocalMaker(page, baseURL);
  for (const title of ["Ночная библиотека", "Токийское кафе", "Оранжерея", "Ателье художника"]) {
    await page.goto("/studio/products");
    await page.getByRole("link", { name: new RegExp(title) }).click();
    const name = page.getByLabel("Название", { exact: true });
    await expect(name).toHaveValue(title);
    await expect(name).toBeEditable();
    await expect(page.getByLabel("Цена", { exact: true })).toBeEditable();
    await expect(page.getByRole("button", { name: "Сохранить изделие" })).toBeEnabled();
  }
});

test("мастер создаёт изделие с фото, публикует, архивирует и удаляет его", async ({page, browser, baseURL}) => {
  test.setTimeout(90_000);
  const title = "Читальный зал со стрельчатыми окнами и галереей для редких книг — " + crypto.randomUUID();
  const description = "На верхней галерее стоят переплетённые вручную тома. ".repeat(12);
  const publicPage = await browser.newPage({baseURL});
  try {
    await signInLocalMaker(page, baseURL);
    await page.goto("/studio/products/new");
    await page.getByLabel("Название",{exact:true}).fill(title);
    await page.getByLabel("Описание", {exact:true}).fill(description);
    const category = page.getByRole("combobox",{name:"Категория",exact:true});
    if (await category.locator("option").count()===1) {
      await page.getByRole("button",{name:"Новая категория"}).click();
      await page.getByLabel("Название категории").fill("Проверочные модели");
      await page.getByRole("button",{name:"Добавить категорию",exact:true}).click();
      await expect(page.getByRole("dialog")).toBeHidden();
    } else await category.selectOption({index:1});
    await page.getByLabel("Цена",{exact:true}).fill("12903505.29");
    await page.getByLabel("Валюта",{exact:true}).fill("RUB");
    await page.getByLabel("Готовые экземпляры в наличии").fill("2");
    await page.getByLabel("Доступно под заказ").check();
    const photo = await sharp({create:{width:480,height:320,channels:3,background:"#315cff"}}).png().toBuffer();
    await page.locator('input[type=file]').setInputFiles({name:"phone-photo.png",mimeType:"image/png",buffer:photo});
    await page.getByRole("button",{name:"Сохранить изделие"}).click();
    await expect(page.getByText("Изменения сохранены.",{exact:true})).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").pop();
    const storePath = "/product/object-"+id;
    await publicPage.goto(storePath);
    await expect(publicPage.getByRole("heading",{name:"Изделие недоступно"})).toBeVisible();
    await page.getByRole("combobox",{name:"Статус изделия"}).selectOption("published");
    const published = page.waitForResponse(r=>r.url().includes("/save") && r.request().method()==="POST");
    await page.getByRole("button",{name:"Сохранить изделие"}).click();
    expect((await published).status()).toBe(200);
    await publicPage.goto(storePath);
    await publicPage.setViewportSize({width:320, height:740});
    await expect(publicPage.getByRole("heading",{name:title,exact:true})).toBeVisible();
    await expect(publicPage.getByText(description.trim(), {exact:true})).toBeVisible();
    expect(await publicPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await expect(publicPage.getByRole("radio",{name:"Готовый экземпляр"})).toBeVisible();
    await expect(publicPage.getByRole("radio",{name:"Изготовление под заказ"})).toBeVisible();
    // A wide price and long title must align with the first short seeded neighbour.
    if (await publicPage.locator(".store-demo-label").count()) {
      await publicPage.setViewportSize({width:390, height:844});
      await publicPage.goto("/catalog");
      const card = publicPage.getByRole("article").filter({has: publicPage.getByRole("heading", {name:title, exact:true})});
      await expect(card).toBeVisible();
      const geometry = await card.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const peer = Array.from(element.parentElement!.querySelectorAll("article")).find(other =>
          other !== element && Math.abs(other.getBoundingClientRect().top - bounds.top) <= 1);
        if (!peer) return null;
        const pair = [element, peer].map(entry => {
          const price = entry.querySelector(".ui-price")!.getBoundingClientRect();
          const photo = entry.querySelector(".store-card-visual")!.getBoundingClientRect();
          return {height:entry.getBoundingClientRect().height, priceY:price.top, photoRatio:photo.width / photo.height};
        });
        return pair;
      });
      expect(geometry, "У новой карточки должен быть сосед в том же ряду").not.toBeNull();
      const [long, short] = geometry!;
      expect(Math.abs(long.height - short.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(long.priceY - short.priceY)).toBeLessThanOrEqual(1);
      expect(Math.abs(long.photoRatio - short.photoRatio)).toBeLessThan(0.01);
    }
    await page.reload();
    await page.getByRole("combobox",{name:"Статус изделия"}).selectOption("archived");
    const archived = page.waitForResponse(r=>r.url().includes("/save") && r.request().method()==="POST");
    await page.getByRole("button",{name:"Сохранить изделие"}).click();
    expect((await archived).status()).toBe(200);
    await publicPage.goto(storePath);
    await expect(publicPage.getByRole("heading",{name:"Изделие недоступно"})).toBeVisible();
    await page.reload();
    await page.getByRole("button",{name:"Удалить изделие",exact:true}).click();
    await page.getByRole("button",{name:"Удалить окончательно"}).click();
    await expect(page.getByText("Изделие удалено.",{exact:true})).toBeVisible();
  } finally { await publicPage.close(); }
});
