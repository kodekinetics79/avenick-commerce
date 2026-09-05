import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getServerB2BContext: vi.fn(),
  getProductBySlug: vi.fn(),
  getRelatedProducts: vi.fn(),
  getBoughtTogether: vi.fn(),
  getTrendingProducts: vi.fn(),
  getCartCompletions: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/b2b-server", () => ({ getServerB2BContext: mocks.getServerB2BContext }));
vi.mock("@avenick/database", () => ({
  getProductBySlug: mocks.getProductBySlug,
  getRelatedProducts: mocks.getRelatedProducts,
  getBoughtTogether: mocks.getBoughtTogether,
  getTrendingProducts: mocks.getTrendingProducts,
  getCartCompletions: mocks.getCartCompletions,
}));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIpFrom: () => "127.0.0.1",
  // catalog-throttle reads the shared rule; an undefined RATE_LIMITS
  // makes every route under test answer 500 for the wrong reason.
  RATE_LIMITS: { catalogRead: { name: "catalog-read", limit: 120, windowMs: 60_000 } },
}));

import { GET as recommendations } from "./products/[slug]/recommendations/route";
import { POST as cartCompletions } from "./cart/completions/route";

const ID = "c" + "a".repeat(24);
const OTHER = "c" + "b".repeat(24);

/** A product priced for BOTH channels, so the DTO's choice is the only variable. */
function row(id: string) {
  return {
    id, sellerId: "seller", sku: id.toUpperCase(), slug: id, nameEn: id, nameAr: id,
    descriptionEn: null, descriptionAr: null, origin: null, tags: [], moq: 1,
    isPubliclyDiscoverable: true, isB2CEnabled: true, isB2BEnabled: true, status: "ACTIVE",
    images: [], variants: [], inventory: [{ variantId: null, qty: 9, reservedQty: 0 }],
    prices: [
      { type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 100, vatRate: 5 },
      { type: "B2B", currency: "AED", minQty: 1, maxQty: null, price: 61.5, vatRate: 5 },
    ],
    category: { nameEn: "Category", nameAr: "Category", slug: "category" }, brand: null,
    seller: { businessNameEn: "Seller", businessNameAr: null, tier: "VERIFIED", rating: 5 },
    rating: null,
  };
}

const hasB2BPricing = (body: unknown) => {
  const text = JSON.stringify(body);
  return /"type"\s*:\s*"B2B"/.test(text) || text.includes("61.5");
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ ok: true, resetAt: Date.now() + 1000 });
  mocks.getProductBySlug.mockResolvedValue({ ...row(ID), isPubliclyDiscoverable: true });
  mocks.getRelatedProducts.mockResolvedValue([row(OTHER)]);
  mocks.getBoughtTogether.mockResolvedValue([]);
  mocks.getTrendingProducts.mockResolvedValue([]);
  mocks.getCartCompletions.mockResolvedValue([row(OTHER)]);
});

const askRecommendations = (b2b: boolean) =>
  recommendations(
    new NextRequest(`http://localhost/api/products/thing/recommendations${b2b ? "?b2b=true" : ""}`),
    { params: { slug: "thing" } },
  );

const askCompletions = (b2b: boolean) =>
  cartCompletions(
    new NextRequest("http://localhost/api/cart/completions", {
      method: "POST",
      body: JSON.stringify({ productIds: [ID], b2b }),
    }),
  );

/**
 * FOUND ON PRODUCTION, ANONYMOUSLY:
 *
 *   GET  /api/products/<slug>/recommendations?b2b=true  → 10 rows of B2B tier prices
 *   POST /api/cart/completions {"b2b": true}            →  8 rows of B2B tier prices
 *
 * `/api/products` and `/api/products/[slug]` checked the session before
 * honouring the flag. The two routes added with the recommendation work reached
 * the same operation without passing that check, and shipped. The guard was on
 * two of four doors, so it moved into resolveCatalogChannel, which is now the
 * only way to obtain a channel at all.
 */
describe("a request cannot assert its own pricing channel", () => {
  it.each([
    ["recommendations", askRecommendations],
    ["cart completions", askCompletions],
  ])("%s refuses B2B pricing to a caller with no company", async (_label, ask) => {
    mocks.getServerB2BContext.mockResolvedValue(null);

    const response = await ask(true);
    expect(response.status).toBe(401);
    expect(hasB2BPricing(await response.json())).toBe(false);
  });

  it.each([
    ["recommendations", askRecommendations],
    ["cart completions", askCompletions],
  ])("%s answers a company member in their own channel", async (_label, ask) => {
    mocks.getServerB2BContext.mockResolvedValue({ companyId: "company", role: "COMPANY_ADMIN" });

    const response = await ask(true);
    expect(response.status).toBe(200);
    expect(hasB2BPricing(await response.json())).toBe(true);
  });

  it.each([
    ["recommendations", askRecommendations],
    ["cart completions", askCompletions],
  ])("%s never quotes B2B pricing on the public channel, session or not", async (_label, ask) => {
    mocks.getServerB2BContext.mockResolvedValue({ companyId: "company", role: "COMPANY_ADMIN" });

    const response = await ask(false);
    expect(response.status).toBe(200);
    expect(hasB2BPricing(await response.json())).toBe(false);
  });

  it("does not consult the session at all for a public request", async () => {
    mocks.getServerB2BContext.mockResolvedValue(null);
    await askCompletions(false);
    expect(mocks.getServerB2BContext).not.toHaveBeenCalled();
  });
});

/**
 * The structural half. A behavioural test only covers the routes someone
 * remembered to write one for — which is exactly what went wrong.
 */
describe("every catalogue route asks the same authority", () => {
  const apiRoot = fileURLToPath(new URL(".", import.meta.url));

  function routeFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return routeFiles(full);
      return entry === "route.ts" ? [full] : [];
    });
  }

  const shapers = routeFiles(apiRoot).filter((file) => {
    const source = readFileSync(file, "utf8");
    return source.includes("toCatalogListDto") || source.includes("toCatalogDetailDto");
  });

  it("finds the catalogue routes", () => {
    expect(shapers.length).toBeGreaterThanOrEqual(4);
  });

  it.each(shapers.map((f) => [f.slice(apiRoot.length), f]))(
    "%s resolves its channel through resolveCatalogChannel",
    (_name, file) => {
      const source = readFileSync(file, "utf8");
      expect(source, "this route shapes catalogue rows without asking who is asking").toContain(
        "resolveCatalogChannel",
      );
      // The exact expression that leaked: a channel taken straight from the request.
      expect(source, "this route decides its channel from the request instead of the session").not.toMatch(
        /channel\s*=\s*wantsB2B\s*\?/,
      );
    },
  );
});
