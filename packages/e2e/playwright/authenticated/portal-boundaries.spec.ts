import { test, expect, type Page } from "@playwright/test";
import { url } from "../../targets.mjs";
import { PERSONAS, storageStatePath } from "../../personas.mjs";

/**
 * Cross-portal authorization boundaries.
 *
 * Certifies refusal, not success. A signed-in buyer holding a valid customer
 * session must not reach Seller Central or the Admin Console, and the API must
 * refuse in the same direction as the UI — a portal that redirects the browser
 * but serves the underlying JSON is not actually protected.
 */

/** True when the response kept the visitor out, whether by redirect or refusal. */
async function wasDenied(page: Page, deniedUrl: string) {
  const response = await page.goto(deniedUrl, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  const landedOnLogin = /\/login/.test(page.url());
  return { denied: landedOnLogin || status === 401 || status === 403, status, url: page.url() };
}

for (const [name, persona] of Object.entries(PERSONAS)) {
  if (persona.deniedPortals.length === 0) continue;

  test.describe(`${persona.label} — portal boundaries`, () => {
    test.use({ storageState: storageStatePath(name) });

    for (const portal of persona.deniedPortals) {
      test(`cannot reach the ${portal} dashboard`, async ({ page }) => {
        const result = await wasDenied(page, url(portal, "/dashboard"));

        expect(
          result.denied,
          `${persona.label} reached the ${portal} dashboard (status ${result.status}, url ${result.url})`,
        ).toBe(true);
      });
    }
  });
}

test.describe("API refuses in the same direction as the UI", () => {
  test("a customer session cannot call the seller API", async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath("buyer") });
    try {
      const response = await context.request.get(url("seller", "/api/seller/orders"));
      expect(
        [401, 403],
        `seller API returned ${response.status()} to a customer session`,
      ).toContain(response.status());
    } finally {
      await context.close();
    }
  });

  test("a customer session cannot call the admin API", async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath("buyer") });
    try {
      const response = await context.request.get(url("admin", "/api/admin/users"));
      expect(
        [401, 403],
        `admin API returned ${response.status()} to a customer session`,
      ).toContain(response.status());
    } finally {
      await context.close();
    }
  });

  test("a seller session cannot call the admin API", async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageStatePath("sellerOwner") });
    try {
      const response = await context.request.get(url("admin", "/api/admin/users"));
      expect(
        [401, 403],
        `admin API returned ${response.status()} to a seller session`,
      ).toContain(response.status());
    } finally {
      await context.close();
    }
  });
});
