import { defineConfig } from "@playwright/test";

const baseURL = process.env.ROOMLET_TEST_URL || "http://127.0.0.1:3255";
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
    timezoneId: "Pacific/Auckland",
  },
  webServer: {
    command: "npm run start -- -H 127.0.0.1 -p " + (new URL(baseURL).port || "3255"),
    url: new URL("/studio/login",baseURL).href,
    reuseExistingServer: !process.env.CI,
  },
});
