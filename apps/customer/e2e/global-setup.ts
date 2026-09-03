import { chromium, type FullConfig } from "@playwright/test";
import { mkdir } from "node:fs/promises";

export default async function globalSetup(config: FullConfig) {
  const email = process.env.SPATIAL_E2E_EMAIL;
  const password = process.env.SPATIAL_E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("SPATIAL_E2E_EMAIL and SPATIAL_E2E_PASSWORD are required");
  }

  const baseURL = String(config.projects[0]?.use.baseURL ?? "http://localhost:13100");
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/b2b/spatial-commerce");
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password/i).fill(password);
  await page.evaluate(async () => {
    const response = await fetch("/api/auth/csrf", { credentials: "same-origin" });
    if (!response.ok) throw new Error("Unable to initialize sign-in protection");
  });
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/b2b\/spatial-commerce$/, { timeout: 15_000 });
  await mkdir("test-results/.auth", { recursive: true });
  await context.storageState({ path: "test-results/.auth/spatial.json" });
  await browser.close();
}
