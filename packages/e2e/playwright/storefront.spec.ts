import { test, expect } from "@playwright/test";
import { url, PUBLIC_CUSTOMER_ROUTES } from "../targets.mjs";

/**
 * Public customer storefront smoke journeys.
 *
 * Scope is deliberately unauthenticated and read-only: these run against any
 * environment without a session and without mutating data, which keeps them
 * safe to point at a deployed runtime.
 *
 * These are smoke checks, not the governed journey cases. PROMPT 00-R defines
 * the real case list; this file proves the harness works end to end.
 */

test.describe("storefront reachability", () => {
  for (const route of PUBLIC_CUSTOMER_ROUTES) {
    test(`public route renders: ${route}`, async ({ page }) => {
      const response = await page.goto(url("customer", route), { waitUntil: "domcontentloaded" });

      expect(response, `no response for ${route}`).toBeTruthy();
      expect(response!.status(), `${route} returned ${response!.status()}`).toBeLessThan(400);

      // A Next.js error boundary still returns 200, so status alone is not enough.
      await expect(page.locator("body")).not.toContainText("Application error");
      await expect(page.locator("body")).not.toContainText("This page could not be found");
    });
  }
});

test.describe("catalog discovery", () => {
  test("products listing renders catalog content", async ({ page }) => {
    await page.goto(url("customer", "/products"), { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/.+/);

    // Either products render, or a truthful empty state does. Both are valid;
    // a blank page is not.
    const body = page.locator("body");
    await expect(body).toBeVisible();
    const text = (await body.innerText()).trim();
    expect(text.length, "products page rendered no text at all").toBeGreaterThan(0);
  });

  test("navigation exposes primary catalog entry points", async ({ page }) => {
    await page.goto(url("customer", "/"), { waitUntil: "domcontentloaded" });

    // Links that the storefront navigation is expected to expose.
    for (const href of ["/products", "/brands"]) {
      await expect(
        page.locator(`a[href^="${href}"]`).first(),
        `no navigation link to ${href}`,
      ).toBeAttached();
    }
  });
});

test.describe("status surface", () => {
  test("status page scopes its claim and never asserts blanket health", async ({ page }) => {
    await page.goto(url("customer", "/status"), { waitUntil: "domcontentloaded" });

    // Scoped headline: process health is stated separately from journeys, and
    // "unverified" is a legitimate state before the first poll resolves.
    await expect(page.locator("body")).toContainText(/process health:/i);
    await expect(page.locator("body")).toContainText(/customer journeys:/i);

    const text = await page.locator("body").innerText();
    expect(text).toMatch(/operational|degraded|down|unverified|not configured|unable to reach/i);

    // The blanket claim this page used to make must not come back.
    expect(text).not.toMatch(/all systems operational/i);
  });

  test("journeys are not reported as healthy without a synthetic", async ({ request }) => {
    const response = await request.get(url("customer", "/api/status"));
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("processStatus");
    expect(body).toHaveProperty("journeyStatus");

    // No journey synthetic runs against this deployment, so the only honest
    // answer is "unverified" — never "operational".
    expect(body.journeyStatus).not.toBe("operational");

    const integrations = body.components.find((c: { name: string }) => c.name === "external-integrations");
    expect(integrations.status).not.toBe("operational");
  });
});
