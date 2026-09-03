import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signInToSpatialPreview(page: Page) {
  await page.goto("/b2b/spatial-commerce");
  await expect(page).toHaveURL(/\/b2b\/spatial-commerce$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Mechanical SKU explorer|مستكشف/);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .include("[data-spatial-state]")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test("desktop shell synchronizes repeated SKU selection with the scene", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInToSpatialPreview(page);

  const viewer = page.locator("#spatial-viewer-panel");
  const skuPane = page.locator('section[aria-labelledby="spatial-sku-heading"]');
  await expect(viewer).toBeVisible();
  await expect(skuPane).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const [viewerBox, skuBox] = await Promise.all([viewer.boundingBox(), skuPane.boundingBox()]);
  expect(viewerBox).not.toBeNull();
  expect(skuBox).not.toBeNull();
  expect(viewerBox!.width / skuBox!.width).toBeGreaterThan(1.35);
  expect(viewerBox!.width / skuBox!.width).toBeLessThan(1.7);

  const shell = page.locator("[data-spatial-state]");
  const firstSku = page.locator('[data-spatial-surface="desktop"][data-spatial-sku-id="fixture-sku-bearing-01"]');
  await firstSku.click();
  await expect(shell).toHaveAttribute("data-selected-node", "mounting-plate");
  await expect(shell).toHaveAttribute("data-pulse-revision", "1");
  await firstSku.click();
  await expect(shell).toHaveAttribute("data-pulse-revision", "2");
  await expect(page.locator("canvas")).toBeVisible();
  const actionableErrors = consoleErrors.filter((message) => !message.includes("Failed to load resource: the server responded with a status of 404"));
  expect(actionableErrors).toEqual([]);
});

test("keyboard selection and reduced motion preserve the standard SKU path", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInToSpatialPreview(page);

  const shell = page.locator("[data-spatial-state]");
  await expect(shell).toHaveAttribute("data-reduced-motion", "true");
  const secondSku = page.locator('[data-spatial-surface="desktop"][data-spatial-sku-id="fixture-sku-fastener-02"]');
  await secondSku.focus();
  await page.keyboard.press("Enter");
  await expect(secondSku).toHaveAttribute("aria-pressed", "true");
  await expect(shell).toHaveAttribute("data-selected-node", "motor-housing");
});

test("mobile is SKU-first and loads the optional viewer on demand", async ({ page }) => {
  await signInToSpatialPreview(page);

  await expect(page.locator('[data-spatial-surface="mobile"]')).toHaveCount(3);
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: /Show 3D viewer|إظهار العارض/ }).click();
  await expect(page.locator("#spatial-viewer-panel")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("Arabic renders with RTL direction and localized SKU content", async ({ page, context }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:13100");
  await context.addCookies([{
    name: "AVENICK_LOCALE",
    value: "ar",
    url: baseURL,
  }]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInToSpatialPreview(page);

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("مستكشف رموز الأصناف الميكانيكية");
  await expect(page.getByRole("table").locator("p").filter({ hasText: "محمل شعاعي تجريبي" })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("no-WebGL keeps semantic part and SKU controls available", async ({ page, context }) => {
  await context.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInToSpatialPreview(page);

  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByText(/Interactive 3D is unavailable|العرض ثلاثي الأبعاد غير متاح/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Mounting plate|لوحة التثبيت/ })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("spatial shell has no automated WCAG A/AA violations", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInToSpatialPreview(page);

  await expectNoAxeViolations(page);
});
