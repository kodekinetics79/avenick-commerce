import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  listProducts: vi.fn(),
  getProductBySlug: vi.fn(),
  getServerB2BContext: vi.fn(),
}));

vi.mock("@avenick/database", () => ({
  db: { category: { findUnique: vi.fn() } },
  listProducts: mocks.listProducts,
  getProductBySlug: mocks.getProductBySlug,
}));
vi.mock("@/lib/b2b-server", () => ({ getServerB2BContext: mocks.getServerB2BContext }));

import { GET as listProductsRoute } from "./route";
import { GET as productDetailRoute } from "./[slug]/route";

const pilotProduct = {
  id: "product", sellerId: "seller", sku: "PILOT-MENNEKES", slug: "pilot-mennekes",
  nameEn: "Pilot Socket", nameAr: "Pilot Socket", descriptionEn: null, descriptionAr: null,
  origin: null, tags: ["pilot-catalog"], moq: 10, status: "ACTIVE",
  isPubliclyDiscoverable: true, isB2CEnabled: false, isB2BEnabled: true,
  images: [], inventory: [], variants: [],
  prices: [{ type: "B2B", currency: "SAR", minQty: 10, maxQty: null, price: 397.7, vatRate: 15 }],
  category: { nameEn: "Industrial", nameAr: "Industrial", slug: "industrial" }, brand: null,
  seller: { id: "seller", businessNameEn: "Pilot Seller", businessNameAr: null, tier: "VERIFIED", rating: 0, reviewCount: 0, city: "Riyadh", country: "SA" },
  reviews: [], weight: null,
  commercialMetadata: {
    purchasePrice: 1, landedCost: 2, vendorCode: "PRIVATE", vendorLegalName: "PRIVATE",
    sourcePayload: { private: true }, sourceFingerprint: "PRIVATE", manufacturerPartNumber: "1145A", erpCode: "ERP-PRIVATE",
  },
  listingHealth: 1,
  issues: [{ message: "PRIVATE" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getServerB2BContext.mockResolvedValue(null);
});

function expectPublicSafe(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "purchasePrice", "landedCost", "vendorCode", "vendorLegalName", "sourcePayload", "sourceFingerprint",
    "commercialMetadata", "listingHealth", "issues", "manufacturerPartNumber", "erpCode", "PRIVATE", '"type":"B2B"',
  ]) expect(serialized).not.toContain(forbidden);
}

describe("public catalog API discovery boundary", () => {
  it("lists a discoverable non-B2C product without private B2B price or metadata", async () => {
    mocks.listProducts.mockResolvedValue({ products: [pilotProduct], total: 1, page: 1, limit: 24, totalPages: 1 });
    const response = await listProductsRoute(new NextRequest("https://customer.test/api/products?search=1145A"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(mocks.listProducts).toHaveBeenCalledWith(expect.objectContaining({ publiclyDiscoverable: true, search: "1145A" }));
    expect(body.products[0]).toMatchObject({ isPubliclyDiscoverable: true, isB2CEnabled: false, prices: [], cardPrice: null });
    expect(body.products[0].inventory).toEqual([{ inStock: false, status: "UNCONFIRMED" }]);
    expectPublicSafe(body);
  });

  it("serves public detail for discovery while filtering private channel data", async () => {
    mocks.getProductBySlug.mockResolvedValue(pilotProduct);
    const response = await productDetailRoute(
      new NextRequest("https://customer.test/api/products/pilot-mennekes"),
      { params: { slug: "pilot-mennekes" } },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(mocks.getProductBySlug).toHaveBeenCalledWith("pilot-mennekes", "B2C", undefined);
    expect(body.data).toMatchObject({ isPubliclyDiscoverable: true, isB2CEnabled: false, prices: [] });
    expect(body.data.inventory).toEqual([{ inStock: false, availableQty: 0, status: "UNCONFIRMED" }]);
    expectPublicSafe(body);
  });
});
