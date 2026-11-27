import { expect, test, type Page } from "@playwright/test";

function isLoopback(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function signInLocalMaker(page: Page, baseURL: string | undefined) {
  const email = process.env.ROOMLET_LOCAL_MAKER_EMAIL;
  const password = process.env.ROOMLET_LOCAL_MAKER_PASSWORD;
  test.skip(!email || !password || !isLoopback(baseURL) || !isLoopback(process.env.NEXT_PUBLIC_SUPABASE_URL),
    "Нужны локальное приложение, локальный Supabase и явные данные тестового мастера.");
  await page.goto("/studio");
  await expect(page).toHaveURL(new URL("/studio/login", baseURL).href);
  await page.getByLabel("Электронная почта").fill(email!);
  await page.getByLabel("Пароль", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("heading", { name: "Сегодня", exact: true })).toBeVisible();
}
