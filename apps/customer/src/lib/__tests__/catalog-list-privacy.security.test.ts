import { describe, expect, it } from "vitest";
import { toCatalogListDto } from "../catalog-list-dto";

describe("public catalog list privacy DTO", () => {
  it("exposes only storefront fields and a boolean stock signal", () => {
    const dto = toCatalogListDto({
      id: "p1", sellerId: "seller", sku: "SKU", slug: "sku", nameEn: "Item", nameAr: "Item",
      descriptionEn: null, descriptionAr: null, origin: "AE", tags: [], moq: 1,
      isB2CEnabled: true, isB2BEnabled: true,
      images: [{ url: "https://image.test/p.png", altText: null }],
      prices: [
        { type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 10, vatRate: 5 },
        { type: "B2B", currency: "AED", minQty: 10, maxQty: null, price: 7, vatRate: 5 },
      ],
      inventory: [{ variantId: "variant", qty: 50, reservedQty: 49 }],
      variants: [{ id: "variant", prices: [] }],
      category: { nameEn: "Category", nameAr: "Category", slug: "category" }, brand: null,
      seller: { businessNameEn: "Seller", businessNameAr: null, tier: "VERIFIED", rating: 5 },
      listingHealth: 12, issues: [{ message: "Missing confidential document" }], createdAt: new Date(),
    } as never, "B2C", "AED");
    expect(dto.prices).toHaveLength(1);
    expect(dto.inventory).toEqual([{ inStock: true }]);
    expect(dto.hasVariants).toBe(true);
    const serialized = JSON.stringify(dto);
    for (const privateField of ["reservedQty", "qty", "listingHealth", "issues", "createdAt", "Missing confidential document"]) {
      expect(serialized).not.toContain(privateField);
    }
  });
});
