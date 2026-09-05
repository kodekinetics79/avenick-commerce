import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCartCompletions: vi.fn(),
  getRelatedProducts: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@avenick/database", () => ({
  getCartCompletions: mocks.getCartCompletions,
  getRelatedProducts: mocks.getRelatedProducts,
}));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIpFrom: () => "127.0.0.1",
  // catalog-throttle reads the shared rule; an undefined RATE_LIMITS
  // makes every route under test answer 500 for the wrong reason.
  RATE_LIMITS: { catalogRead: { name: "catalog-read", limit: 120, windowMs: 60_000 } },
}));
// The route resolves its channel through @/lib/catalog-channel, which reads the
// session. These cases are all public-channel, so the context is never
// consulted — but the module still has to load, and next-auth cannot in this
// environment. Channel authority itself is covered in
// catalog-channel-authority.security.test.ts.
vi.mock("@/lib/b2b-server", () => ({ getServerB2BContext: async () => null }));

import { POST } from "./route";

const BASKET = "c" + "a".repeat(24);
const OTHER = "c" + "b".repeat(24);

function row(id: string) {
  return {
    id, sellerId: "seller", sku: id.toUpperCase(), slug: id, nameEn: id, nameAr: id,
    descriptionEn: null, descriptionAr: null, origin: null, tags: [], moq: 1,
    isPubliclyDiscoverable: true, isB2CEnabled: true, isB2BEnabled: false,
    images: [], variants: [], inventory: [{ variantId: null, qty: 4, reservedQty: 0 }],
    prices: [{ type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 12, vatRate: 5 }],
    category: { nameEn: "Category", nameAr: "Category", slug: "category" }, brand: null,
    seller: { businessNameEn: "Seller", businessNameAr: null, tier: "VERIFIED", rating: 5 },
    rating: null,
  };
}

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/cart/completions", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ ok: true, resetAt: Date.now() + 1000 });
});

describe("POST /api/cart/completions", () => {
  it("reports a co-purchase basis and never asks for affinity when buyers have spoken", async () => {
    mocks.getCartCompletions.mockResolvedValue([row(OTHER)]);

    const body = await (await post({ productIds: [BASKET] })).json();

    expect(body.basis).toBe("co-purchase");
    expect(body.data).toHaveLength(1);
    expect(mocks.getRelatedProducts).not.toHaveBeenCalled();
  });

  /**
   * The whole point of the fallback: `getCartCompletions` requires two distinct
   * buyers of the same pair before it will claim anything, so on a young
   * catalogue every basket got an empty rail. Affinity fills it — under a
   * heading that says what it is.
   */
  it("falls back to affinity for the last line added, and says so", async () => {
    mocks.getCartCompletions.mockResolvedValue([]);
    mocks.getRelatedProducts.mockResolvedValue([row(OTHER)]);

    const body = await (await post({ productIds: ["c" + "c".repeat(24), BASKET] })).json();

    expect(body.basis).toBe("related");
    expect(body.data).toHaveLength(1);
    expect(mocks.getRelatedProducts).toHaveBeenCalledWith(BASKET, { limit: 8 });
  });

  it("never suggests something already in the basket, from either source", async () => {
    mocks.getCartCompletions.mockResolvedValue([]);
    mocks.getRelatedProducts.mockResolvedValue([row(BASKET), row(OTHER)]);

    const body = await (await post({ productIds: [BASKET] })).json();

    expect(body.data.map((r: { id: string }) => r.id)).toEqual([OTHER]);
  });

  it("keeps price privacy on the fallback rows: a consumer basket sees no B2B price", async () => {
    mocks.getCartCompletions.mockResolvedValue([]);
    const b2bOnly = { ...row(OTHER), isB2CEnabled: false, isB2BEnabled: true,
      prices: [{ type: "B2B", currency: "AED", minQty: 1, maxQty: null, price: 7, vatRate: 5 }] };
    mocks.getRelatedProducts.mockResolvedValue([b2bOnly]);

    const body = await (await post({ productIds: [BASKET] })).json();

    expect(body.data[0].prices).toEqual([]);
    expect(body.data[0].cardPrice).toBeNull();
    expect(JSON.stringify(body.data)).not.toContain('"price":7');
  });

  it("answers an empty basket without touching either service", async () => {
    const body = await (await post({ productIds: [] })).json();
    expect(body.data).toEqual([]);
    expect(mocks.getCartCompletions).not.toHaveBeenCalled();
    expect(mocks.getRelatedProducts).not.toHaveBeenCalled();
  });
});
