import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

type LocalAccount = { role: "customer" | "maker" | "owner"; email: string; password: string };

async function previewAccounts(baseURL?: string): Promise<LocalAccount[]> {
  if (!baseURL || !["http://127.0.0.1:3211", "http://localhost:3211"].includes(new URL(baseURL).origin)) return [];
  try {
    return JSON.parse(await readFile(".roomlet-demo/accounts.json", "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

test("гость открывает профиль, форму входа и собственное избранное", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Мой профиль" })).toBeVisible();
  await expect(page.getByText("Гость", { exact: true })).toBeVisible();
  const heading = await page.getByRole("heading", { name: "Мой профиль" }).boundingBox();
  const identity = await page.locator(".profile-identity").boundingBox();
  expect(identity!.y - (heading!.y + heading!.height)).toBeGreaterThanOrEqual(12);
  await expect(page.getByRole("navigation", { name: "Разделы магазина" })
    .getByRole("link", { name: "Профиль" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator('a[href^="/studio"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Уведомления" })).toHaveCount(0);
  await page.getByRole("link", { name: "Войти", exact: true }).click();
  await expect(page.getByLabel("Электронная почта")).toBeVisible();
  await expect(page.getByRole("heading", { name: "С возвращением." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Разделы магазина" })
    .getByRole("link", { name: "Профиль" })).toHaveAttribute("aria-current", "location");
  await page.goto("/profile");
  await page.getByRole("navigation", { name: "Разделы профиля" }).getByRole("link", { name: "Избранное" }).click();
  await expect(page.getByRole("heading", { name: "Избранное", exact: true })).toBeVisible();
});

test("сохранённые до перехода демозаявки доступны на отдельной странице", async ({ page, baseURL }) => {
  test.skip(!baseURL || !["http://127.0.0.1:3211", "http://localhost:3211"].includes(new URL(baseURL).origin), "Нужен изолированный предпросмотр");
  await page.addInitScript(() => {
    localStorage.setItem("roomlet.store.v1", JSON.stringify({
      favorites: [], cart: [],
      orders: [{ id: "4f13c1de", date: "2026-10-20T00:00:00Z", method: "Самовывоз",
        lines: [{ slug: "night-library", mode: "ready", window: null }] }],
      briefs: [{ id: "a934bd77", idea: "Моя миниатюрная библиотека", budget: "9000", deadline: "", reference: "" }],
    }));
  });
  await page.goto("/profile");
  await expect(page.getByText("Моя миниатюрная библиотека")).toHaveCount(0);
  await page.getByRole("link", { name: "Мои заказы" }).click();
  await expect(page.getByText("Заявка № 4F13C1")).toBeVisible();
  await expect(page.getByText("Ночная библиотека · Готовый экземпляр")).toBeVisible();
  await expect(page.getByText("Моя миниатюрная библиотека")).toBeVisible();
});

for (const role of ["customer", "maker", "owner"] as const) {
  test(`профиль учитывает права ${role} и выход из Supabase`, async ({ page, baseURL }) => {
    const account = (await previewAccounts(baseURL)).find(entry => entry.role === role);
    test.skip(!account, "Нужна тестовая учётная запись этой роли в локальном предпросмотре");
    await page.goto("/profile/login");
    await page.getByLabel("Электронная почта").fill(account!.email);
    await page.getByLabel("Пароль", { exact: true }).fill(account!.password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByRole("button", { name: "Выйти из аккаунта" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Roomlet Studio/ })).toHaveCount(role === "customer" ? 0 : 1);
    await expect(page.getByRole("link", { name: "Управление командой" })).toHaveCount(role === "owner" ? 1 : 0);
    if (role !== "customer") {
      await page.getByRole("link", { name: /Roomlet Studio/ }).click();
      await expect(page.getByRole("navigation", { name: "Мастерская" })).toBeVisible();
      await page.goto("/profile");
    }
    await page.getByRole("button", { name: "Выйти из аккаунта" }).click();
    await expect(page.getByRole("link", { name: "Войти", exact: true })).toBeVisible();
    await expect(page.locator('a[href^="/studio"]')).toHaveCount(0);
  });
}
