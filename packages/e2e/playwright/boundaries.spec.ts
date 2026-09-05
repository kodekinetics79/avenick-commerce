import { test, expect, type APIRequestContext } from "@playwright/test";
import { url } from "../targets.mjs";

/**
 * Where the anonymous boundary sits, in both directions.
 *
 * Protected pages must send a visitor to sign in AND tell the login page where
 * they were going; public endpoints must NOT be swallowed by the same
 * middleware. The second half encodes a defect that shipped: the storefront's
 * view beacon — public by design, because most browsing is anonymous — was
 * answered 401 by the auth middleware, so the Trending rail measured nothing
 * and reported it as calm.
 *
 * Read-only apart from the beacon itself, which is what a page view does: one
 * per-product, per-day counter, and only when the id names a real product.
 */

const PROTECTED_PAGES = [
  { portal: "seller" as const, path: "/dashboard" },
  { portal: "seller" as const, path: "/settings" },
  { portal: "seller" as const, path: "/products" },
  // With a query string: the middleware must carry it, or the visitor returns
  // to a different page than the one they were sent away from.
  { portal: "seller" as const, path: "/orders?status=PENDING" },
  { portal: "admin" as const, path: "/dashboard" },
  { portal: "admin" as const, path: "/shipping-zones" },
  { portal: "admin" as const, path: "/orders" },
  { portal: "admin" as const, path: "/sellers/pending" },
  // The B2B company subtree. `/b2b` itself is public by exact match so a
  // prospect reaches the registration door; PUBLIC_PATHS is prefix-matched, so
  // one careless entry there would open every one of these at once.
  { portal: "customer" as const, path: "/b2b/team" },
  { portal: "customer" as const, path: "/b2b/billing" },
  { portal: "customer" as const, path: "/b2b/purchase-orders" },
  { portal: "customer" as const, path: "/b2b/quotes" },
];

test.describe("protected pages send anonymous visitors to sign in, and say where they were going", () => {
  for (const { portal, path } of PROTECTED_PAGES) {
    test(`${portal} ${path} redirects to /login?callbackUrl=${encodeURIComponent(path)}`, async ({ request }) => {
      // No redirect following: the assertion is about the redirect itself.
      const response = await request.get(url(portal, path), { maxRedirects: 0 });
      expect(
        [302, 303, 307, 308],
        `${portal} ${path} answered HTTP ${response.status()} to an anonymous visitor instead of redirecting`,
      ).toContain(response.status());

      const location = response.headers()["location"];
      expect(location, `${portal} ${path} redirected without a Location header`).toBeTruthy();

      const target = new URL(location!, url(portal, "/"));
      expect(target.origin, "the redirect must stay on this portal").toBe(new URL(url(portal, "/")).origin);
      expect(target.pathname).toBe("/login");
      expect(target.searchParams.get("callbackUrl"), "callbackUrl must carry the path and its query string").toBe(path);
    });
  }

  // The two pages that broke today, driven by a browser: after the bounce the
  // visitor is standing in front of a login form, not an error.
  for (const { portal, path } of [
    { portal: "seller" as const, path: "/settings" },
    { portal: "admin" as const, path: "/shipping-zones" },
  ]) {
    test(`a browser sent away from ${portal} ${path} lands on the login form`, async ({ page }) => {
      await page.goto(url(portal, path), { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/login\?callbackUrl=/);
      await expect(page.locator('form:has(input[type="password"])')).toHaveCount(1);
    });
  }
});

test.describe("protected APIs refuse anonymous callers with JSON, not a redirect", () => {
  for (const { portal, path } of [
    { portal: "customer" as const, path: "/api/orders" },
    { portal: "seller" as const, path: "/api/seller/dashboard" },
    { portal: "admin" as const, path: "/api/admin/users" },
  ]) {
    test(`${portal} ${path} answers 401`, async ({ request }) => {
      const response = await request.get(url(portal, path), { maxRedirects: 0 });
      expect(response.status(), `${portal} ${path} answered HTTP ${response.status()} to an anonymous caller`).toBe(401);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  }
});

/**
 * Shape-valid, names no product. The route answers it "ignored" and writes
 * nothing, which is the honest result when the catalogue is empty.
 */
const PROBE_PRODUCT_ID = "e2e-boundaries-probe";

async function firstProductId(request: APIRequestContext): Promise<string | null> {
  const response = await request.get(url("customer", "/api/products?limit=1"));
  if (response.status() !== 200) return null;
  const body = await response.json().catch(() => null);
  const id = body?.products?.[0]?.id;
  return typeof id === "string" ? id : null;
}

/** Post the way navigator.sendBeacon does: a text blob the route parses itself. */
function beacon(request: APIRequestContext, data: string) {
  return request.post(url("customer", "/api/signals/view"), {
    headers: { "content-type": "text/plain;charset=UTF-8" },
    data,
  });
}

test.describe("the public view beacon", () => {
  test("POST /api/signals/view is reachable without a session and answers 202 with an outcome", async ({ request }) => {
    const productId = await firstProductId(request);
    const response = await beacon(request, JSON.stringify({ productId: productId ?? PROBE_PRODUCT_ID }));

    expect(
      response.status(),
      `/api/signals/view answered HTTP ${response.status()}. A 401 means the auth middleware swallowed a ` +
        `public endpoint again (PUBLIC_API_PATHS in packages/auth/src/middleware.ts); a 5xx breaks the ` +
        `route's own promise that it never fails the page.`,
    ).toBe(202);

    const body = await response.json();
    expect(body).toEqual({
      success: true,
      outcome: expect.stringMatching(/^(?:counted|duplicate|ignored|unavailable)$/),
    });
    expect(
      body.outcome,
      `the beacon reports its store as unavailable, so no view is being recorded — Trending is measuring nothing`,
    ).not.toBe("unavailable");

    if (productId) {
      // A real product: counted, or "duplicate" when this address already
      // counted it today — which is the de-duplication fence working.
      expect(["counted", "duplicate"]).toContain(body.outcome);
    } else {
      expect(body.outcome, "an id that names no product must be ignored, never counted").toBe("ignored");
    }
  });

  const GARBAGE = [
    ["a body that is not JSON", "not json"],
    ["an empty body", ""],
    ["a productId that is not an id", JSON.stringify({ productId: "../../etc/passwd" })],
    ["a body with no productId", JSON.stringify({})],
    ["a body over the size cap", JSON.stringify({ productId: "x".repeat(600) })],
  ] as const;

  for (const [label, data] of GARBAGE) {
    test(`POST /api/signals/view answers 400 to ${label}`, async ({ request }) => {
      const response = await beacon(request, data);
      expect(response.status(), `${label}: HTTP ${response.status()}`).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe("string");
    });
  }
});

test.describe("the public category tree", () => {
  test("GET /api/categories answers a tree, not a flat list", async ({ request }) => {
    const response = await request.get(url("customer", "/api/categories"));
    expect(response.status(), `/api/categories answered HTTP ${response.status()}`).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data), "data must be an array of root categories").toBe(true);
    expect(body.data.length, "the category tree is empty — navigation has nothing to show").toBeGreaterThan(0);
    expect(Array.isArray(body.data[0].children), "data[0].children must be an array — the tree lost its depth").toBe(true);

    for (const node of body.data) {
      expect(typeof node.slug).toBe("string");
      expect(typeof node.nameEn).toBe("string");
      expect(Array.isArray(node.children)).toBe(true);
    }
  });
});

test.describe("the business door", () => {
  /**
   * `/b2b` is the header's "For business" link and the footer's "B2B portal".
   * It is the workspace, and it handles a visitor it cannot place by redirecting
   * to /b2b/register — the door built for a prospect. While the middleware gated
   * it, that redirect could never run and the one visitor the door exists to
   * catch met a bare login instead.
   */
  test("an anonymous visitor following 'For business' lands on the registration door", async ({ page }) => {
    const response = await page.goto(url("customer", "/b2b"), { waitUntil: "networkidle" });

    expect(response?.status(), "the hub answered an error to an anonymous visitor").toBeLessThan(400);
    expect(
      new URL(page.url()).pathname,
      `an anonymous visitor to /b2b landed on ${page.url()} instead of the registration door`,
    ).toBe("/b2b/register");
    await expect(page.locator("form, a[href*='register'], button")).not.toHaveCount(0);
  });
});
