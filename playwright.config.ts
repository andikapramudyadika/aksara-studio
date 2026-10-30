import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:4173",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    acceptDownloads: true,
  },
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
      },
  reporter: "list",
});
