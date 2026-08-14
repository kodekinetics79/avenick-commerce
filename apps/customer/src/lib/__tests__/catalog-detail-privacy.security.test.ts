import { describe, expect, it } from "vitest";
import { toCatalogDetailDto } from "../catalog-detail-dto";

describe("public catalog detail privacy DTO", () => {
  it("returns storefront data without internal records, documents, or exact stock", () => {
    const dto = toCatalogDetailDto({
      id: "product", sellerId: "seller", sku: "SKU", slug: "sku", nameEn: "Item", nameAr: "Item",
      descriptionEn: "Description", descriptionAr: null, isB2CEnabled: true, isB2BEnabled: false,
      origin: "AE", weight: 2, moq: 1,
      images: [{ id: "image-id", productId: "product", url: "https://images.test/item.png", altEn: null, altAr: null, isPrimary: true, sortOrder: 0 }],
      prices: [{ id: "price-id", productId: "product", type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 10, vatRate: 5, createdAt: new Date() }],
      inventory: [{ variantId: null, available: 0 }, { variantId: "variant-selector", available: 4 }],
      seller: { id: "seller", businessNameEn: "Seller", businessNameAr: null, tier: "VERIFIED", rating: 5, reviewCount: 1, city: "Dubai", country: "AE" },
      reviews: [{ id: "review", productId: "product", userId: "private-user", rating: 5, title: null, body: "Good", isVerified: true, createdAt: new Date(), user: { firstName: "A", lastName: "B" } }],
      listingHealth: 12, createdAt: new Date(), updatedAt: new Date(),
      compliance: [{ fileUrl: "https://private.test/certificate.pdf", fileName: "secret-certificate.pdf", certificateNo: "CERT-PRIVATE" }],
      variants: [{
        id: "variant-selector", productId: "product", sku: "SKU-V", nameEn: "Blue", nameAr: null,
        attributes: { color: "blue" }, isActive: true,
        prices: [{ id: "variant-price-id", variantId: "variant-selector", type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 12, vatRate: 0 }],
      }],
    } as never);

    expect(dto.inventory).toEqual([{ inStock: false, availableQty: 0 }]);
    expect(dto.variants).toEqual([{
      id: "variant-selector", sku: "SKU-V", nameEn: "Blue", nameAr: null,
      attributes: { color: "blue" }, inStock: true, availableQty: 4,
      prices: [{ type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 12, vatRate: 0 }],
    }]);
    expect(dto.images).toEqual([{ url: "https://images.test/item.png", altEn: null, altAr: null, isPrimary: true, sortOrder: 0 }]);
    const serialized = JSON.stringify(dto);
    for (const privateValue of [
      "listingHealth", "updatedAt", "compliance", "fileUrl", "secret-certificate.pdf", "CERT-PRIVATE",
      "price-id", "variant-price-id", "private-user", "productId",
    ]) expect(serialized).not.toContain(privateValue);
  });

  it("requires aggregate stock to meet MOQ for base and variant availability", () => {
    const source = {
      id: "p", sellerId: "s", sku: "P", slug: "p", nameEn: "P", nameAr: "P",
      descriptionEn: null, descriptionAr: null, isB2CEnabled: true, isB2BEnabled: false,
      origin: null, weight: null, moq: 10, images: [], prices: [], seller: {
        businessNameEn: "S", businessNameAr: null, tier: "VERIFIED", rating: 0,
        reviewCount: 0, city: "Dubai", country: "AE",
      }, reviews: [], variants: [{ id: "v", sku: "V", nameEn: "V", nameAr: null, attributes: {}, isActive: true, prices: [] }],
      inventory: [{ variantId: null, available: 9 }, { variantId: "v", available: 5 }, { variantId: "v", available: 5 }],
    };
    const dto = toCatalogDetailDto(source);
    expect(dto.inventory).toEqual([{ inStock: false, availableQty: 9 }]);
    expect(dto.variants[0]?.inStock).toBe(true);
    expect(dto.variants[0]?.availableQty).toBe(10);
  });
});
