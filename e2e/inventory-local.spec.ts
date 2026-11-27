import { expect, test } from "@playwright/test";
import sharp from "sharp";

function loopback(url: string | undefined) {
  if (!url) return false;
  try { return ["127.0.0.1","localhost","[::1]"].includes(new URL(url).hostname); }
  catch { return false; }
}

test("мастер создаёт изделие с фото, публикует, архивирует и удаляет его", async ({page, browser, baseURL}) => {
  test.skip(!loopback(process.env.NEXT_PUBLIC_SUPABASE_URL) || !loopback(baseURL) ||
    !process.env.ROOMLET_LOCAL_MAKER_EMAIL || !process.env.ROOMLET_LOCAL_MAKER_PASSWORD,
    "Нужны локальный стек Supabase, локальное приложение и тестовый аккаунт мастера.");
  test.setTimeout(90_000);
  const title = "Проверка изделия " + crypto.randomUUID();
  const publicPage = await browser.newPage({baseURL});
  try {
    await page.goto("/studio/products");
    await page.getByLabel("Электронная почта").fill(process.env.ROOMLET_LOCAL_MAKER_EMAIL!);
    await page.getByLabel("Пароль").fill(process.env.ROOMLET_LOCAL_MAKER_PASSWORD!);
    await page.getByRole("button",{name:"Войти"}).click();
    await page.getByRole("heading",{name:"Сегодня"}).waitFor();
    await page.goto("/studio/products/new");
    await page.getByLabel("Название",{exact:true}).fill(title);
    const category = page.getByRole("combobox",{name:"Категория",exact:true});
    if (await category.locator("option").count()===1) {
      await page.getByRole("button",{name:"Новая категория"}).click();
      await page.getByLabel("Название категории").fill("Проверочные модели");
      await page.getByRole("button",{name:"Добавить категорию",exact:true}).click();
      await expect(page.getByRole("dialog")).toBeHidden();
    } else await category.selectOption({index:1});
    await page.getByLabel("Цена",{exact:true}).fill("150.29");
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
    await expect(publicPage.getByRole("heading",{name:title,exact:true})).toBeVisible();
    await expect(publicPage.getByRole("radio",{name:"Готовый экземпляр"})).toBeVisible();
    await expect(publicPage.getByRole("radio",{name:"Изготовление под заказ"})).toBeVisible();
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
