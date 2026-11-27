import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const widths = [320, 360, 390, 430, 1366];
const routes = {
  home: "/", catalog: "/catalog", product: "/product/atelier",
  studio: "/studio", calendar: "/studio/calendar", design: "/design-system",
} as const;

for (const width of widths) {
  test(`основные экраны при ширине ${width} px`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: width > 768 ? 900 : 844 });
    await page.goto("/studio");
    await page.getByRole("button", { name: /Открыть демо/ }).click();
    await expect(page.getByRole("heading", { name: "Сегодня", exact: true })).toBeVisible();
    for (const [name, path] of Object.entries(routes)) {
      await page.goto(path);
      await page.locator("h1").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (name === "product") {
        await page.getByRole("radio", { name: "Изготовление под заказ" }).check();
        await page.getByRole("button", { name: /Можно выбрать начало/ }).first().waitFor();
      }
      await page.evaluate(() => window.scrollTo(0,0));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, name).toBeLessThanOrEqual(0);
      if (process.env.ROOMLET_SCREENSHOTS && (width === 390 || width === 1366)) {
        await mkdir("docs/screenshots", { recursive: true });
        await page.screenshot({path: `docs/screenshots/${name}-${width}.png`, animations: "disabled"});
        if (name === "product") {
          const booking = page.getByRole("region", {name:"Выбор производственного окна"});
          await booking.scrollIntoViewIfNeeded();
          await page.screenshot({path: `docs/screenshots/booking-${width}.png`, animations: "disabled"});
        }
      }
    }
    expect(errors).toEqual([]);
  });
}
