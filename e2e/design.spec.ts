import { expect, test } from "@playwright/test";

test("Диалог удерживает фокус, Escape возвращает его на кнопку", async ({ page }) => {
  await page.goto("/design-system");
  const trigger = page.getByRole("button", { name: "Диалог", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Очистить избранное?" });
  await expect(dialog).toBeVisible();
  const first = dialog.getByRole("button", { name: "Закрыть", exact: true });
  const last = dialog.getByRole("button", { name: "Очистить", exact: true });
  await expect(first).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Отмена" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(last).toBeFocused();
  await trigger.evaluate((button) => (button as HTMLButtonElement).focus());
  await expect(last).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Отмена" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test.describe("Образцы на сенсорном экране", () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 720 } });

  test("Панель ведёт к календарю, доступна работа с состояниями полей и уведомлением", async ({ page }) => {
    await page.goto("/design-system");
    const controls = page.locator("#controls");
    const panelButton = controls.getByRole("button", { name: "Нижняя панель" });
    await panelButton.tap();
    const panel = page.getByRole("dialog", { name: "Перейти к разделу" });
    await expect(panel).toBeVisible();
    await panel.getByRole("link", { name: "Бронирование" }).tap();
    await expect(page).toHaveURL(/#booking$/);
    await expect(panel).toHaveCount(0);
    const email = controls.getByLabel("Электронная почта");
    await email.fill("incomplete");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Проверьте адрес электронной почты.");
    await email.fill("hello@example.ru");
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
    await controls.getByRole("searchbox", { name: "Найти цвет" }).fill("#315CFF");
    await expect(controls.getByRole("status")).toHaveText("Primary");
    await controls.getByRole("button", { name: "Уведомление" }).tap();
    const toast = page.locator(".ui-toast");
    await expect(toast.getByRole("status")).toHaveText("Пример уведомления");
    await toast.getByRole("button", { name: "Закрыть уведомление" }).tap();
    await expect(toast).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
});
