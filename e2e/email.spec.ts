import { expect, test } from "@playwright/test";

test("регистрация и восстановление доступны без входа", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("link", { name: "Создать аккаунт" }).click();
  await expect(page.getByRole("heading", { name: "Создать аккаунт" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Продолжить с Telegram" })).toBeDisabled();
  await page.getByText("Добавить имя", { exact: true }).click();
  await expect(page.getByLabel("Имя в профиле")).toBeVisible();
  await page.getByRole("link", { name: "Войти", exact: true }).click();
  await page.getByRole("link", { name: "Забыли пароль?" }).click();
  await expect(page.getByRole("button", { name: "Получить письмо" })).toBeVisible();
});

test("на компьютере Escape возвращает на предыдущий уровень и сохраняет ввод", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/profile/login?next=/profile/orders");
  await page.getByRole("link", { name: "Создать аккаунт" }).click();
  const email = page.getByLabel("Электронная почта");
  await email.fill("visitor@example.test");
  await email.press("Escape");
  await expect(email).toHaveValue("visitor@example.test");
  await page.getByRole("heading", { name: "Создать аккаунт" }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/profile\/login\?next=%2Fprofile%2Forders$/);
  await expect(page.getByRole("heading", { name: "Вход в профиль" })).toBeVisible();
});

test.describe("отправка формы до загрузки JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("сервер возвращает ошибку входа и остаётся доступен", async ({ page, baseURL }) => {
    test.skip(!baseURL || !["http://127.0.0.1:3211", "http://localhost:3211"].includes(new URL(baseURL).origin),
      "Проверка неверного пароля выполняется в локальной демобазе.");
    await page.goto("/profile/login");
    await page.getByLabel("Электронная почта").fill("phase23-no-account@roomlet.local");
    await page.getByLabel("Пароль", { exact: true }).fill("test-password");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Проверьте почту и пароль");
    await page.goto("/catalog");
    await expect(page.getByRole("heading", { name: "Каталог", exact: true })).toBeVisible();
  });
});
