import { expect, test } from "@playwright/test";
import { signInLocalMaker } from "./local-maker";

test("срок проекта выбирается с клавиатуры на телефоне", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/custom");
  const trigger = page.getByRole("button", { name: /Желаемый срок/ });
  test.skip(await page.getByText("Приём заявок пока закрыт", { exact: true }).isVisible(), "Нужен демонстрационный магазин.");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Желаемый срок" });
  const today = dialog.locator('button[aria-current="date"]');
  const bounds = await today.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  await today.focus();
  await page.keyboard.press("PageDown");
  const next = dialog.locator("[data-day]:focus");
  const selected = await next.getAttribute("data-day");
  await next.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('input[name="deadline"]')).toHaveValue(selected!);
});

test("период блокировки пересекает границу года без сохранения формы", async ({ page, baseURL }) => {
  await signInLocalMaker(page, baseURL);
  await page.goto("/studio/settings?day=2040-12-31");
  const range = page.getByRole("group", { name: "Период блокировки" });
  const start = range.locator('[data-day="2040-12-31"]');
  await start.click();
  await expect(range.locator('input[name="end"]')).toHaveValue("");
  await start.press("ArrowRight");
  const end = range.locator('[data-day="2041-01-01"]');
  await expect(end).toBeFocused();
  await end.press("Enter");
  await expect(range.locator('input[name="start"]')).toHaveValue("2040-12-31");
  await expect(range.locator('input[name="end"]')).toHaveValue("2041-01-01");
  await expect(page.getByRole("button", { name: "Закрыть период" })).toBeEnabled();
  await range.getByRole("button", { name: "Сбросить" }).click();
  await expect(page.getByRole("button", { name: "Закрыть период" })).toBeDisabled();
});
