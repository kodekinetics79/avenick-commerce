import { test, expect } from "@playwright/test";
import { url, FORBIDDEN_ON_PUBLIC_PAGES } from "../targets.mjs";

/**
 * ============================================================================
 * EXPECTED TO FAIL on the tree audited in
 * AVENICK_GATE_1_WORKTREE_AUDIT_2026-08-17.md. That is intentional.
 * ============================================================================
 *
 * This file encodes defect D-01 (CRITICAL): working credential pairs are
 * rendered on the unauthenticated login page of all three portals —
 *
 *   apps/admin/src/app/login/page.tsx:53     admin@avenick.test  · Password123!
 *   apps/customer/src/app/login/page.tsx:65  buyer@avenick.test  · Password123!
 *   apps/seller/src/app/login/page.tsx:53    seller@avenick.test · Password123!
 *
 * A red result here is the regression guard doing its job. It should turn green
 * only when the credentials are actually removed — never by weakening the
 * assertion or skipping the test.
 */

const LOGIN_PAGES = [
  { portal: "customer" as const, path: "/login" },
  { portal: "seller" as const, path: "/login" },
  { portal: "admin" as const, path: "/login" },
];

test.describe("D-01 — no credentials on unauthenticated surfaces", () => {
  for (const { portal, path } of LOGIN_PAGES) {
    test(`${portal} login page leaks no credentials`, async ({ page }) => {
      await page.goto(url(portal, path), { waitUntil: "domcontentloaded" });

      const rendered = await page.locator("body").innerText();

      for (const secret of FORBIDDEN_ON_PUBLIC_PAGES) {
        expect(
          rendered,
          `${portal} login page renders the credential string "${secret}" to unauthenticated visitors (defect D-01)`,
        ).not.toContain(secret);
      }
    });
  }
});

test.describe("D-01 — credentials absent from served HTML", () => {
  for (const { portal, path } of LOGIN_PAGES) {
    test(`${portal} login HTML source is clean`, async ({ request }) => {
      // Checking rendered text is not sufficient on its own — a credential
      // hidden by CSS still ships in the payload.
      const response = await request.get(url(portal, path));
      expect(response.status()).toBeLessThan(400);

      const html = await response.text();
      for (const secret of FORBIDDEN_ON_PUBLIC_PAGES) {
        expect(
          html,
          `${portal} login HTML payload contains "${secret}" (defect D-01)`,
        ).not.toContain(secret);
      }
    });
  }
});

test.describe("authorization fails closed", () => {
  test("admin dashboard is not reachable without a session", async ({ page }) => {
    await page.goto(url("admin", "/dashboard"), { waitUntil: "domcontentloaded" });

    // Middleware must redirect to /login rather than render the dashboard.
    await expect(page).toHaveURL(/\/login/);
  });

  test("seller dashboard is not reachable without a session", async ({ page }) => {
    await page.goto(url("seller", "/dashboard"), { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/login/);
  });

  test("customer checkout requires a session", async ({ page }) => {
    await page.goto(url("customer", "/checkout"), { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/login/);
  });
});
