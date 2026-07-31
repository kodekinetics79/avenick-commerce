import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: process.env.SPATIAL_E2E_BASE_URL ?? "http://localhost:13100",
    storageState: "test-results/.auth/spatial.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  expect: { timeout: 10_000 },
  timeout: 45_000,
  projects: [
    {
      name: "chrome-desktop",
      grepInvert: /mobile is SKU-first/,
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "chrome-mobile",
      grep: /mobile is SKU-first/,
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
    {
      name: "firefox",
      grepInvert: /mobile is SKU-first/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      grepInvert: /mobile is SKU-first/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
