import { defineConfig } from "@playwright/test";

const baseURL = process.env.ROOMLET_TEST_URL || "http://127.0.0.1:3210";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 45_000,
  reporter: "list",
  use: {
    baseURL,
    channel: process.platform === "win32" ? "chrome" : undefined,
    viewport: { width: 390, height: 844 },
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
  },
  webServer: {
    command: "npm run start -- -H 127.0.0.1 -p 3210",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
