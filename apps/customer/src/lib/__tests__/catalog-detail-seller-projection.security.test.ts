import { describe, expect, it } from "vitest";
import { toCatalogDetailDto, type CatalogDetailSource } from "../catalog-detail-dto";

/**
 * The detail DTO names every seller field it sends.
 *
 * WHY. It used to pass the service's seller object through whole
 * (`seller: source.seller`). That was harmless while the select was six columns,
 * and became a leak the moment anything was added to it — which the seller
 * verification basis now does: the service reads the seller's approved documents
 * to decide whether a "Verified" mark may render. The browser gets the type and
 * review date of one document and nothing else; the relation itself, file URLs,
 * registration numbers and the unwritten rating columns never leave the server.
 */

const source = (seller: Record<string, unknown>) => ({
  id: "p", sellerId: "s1", sku: "P", slug: "p", nameEn: "P", nameAr: "P",
  descriptionEn: null, descriptionAr: null, isPubliclyDiscoverable: true, isB2CEnabled: false, isB2BEnabled: true,
  origin: null, weight: null, moq: 1, images: [], prices: [], inventory: [], variants: [], reviews: [],
  seller: {
    id: "s1", businessNameEn: "Seller", businessNameAr: null, tier: "VERIFIED", city: "Riyadh", country: "SA",
    reviewSummary: { averageRating: null, reviewCount: 0 },
    ...seller,
  },
}) as unknown as CatalogDetailSource;

describe("catalog detail seller projection", () => {
  it("carries the verification citation and nothing else from the seller's documents", () => {
    const reviewedAt = new Date("2026-02-14T09:00:00.000Z");
    const dto = toCatalogDetailDto(source({
      verification: { type: "TRADE_LICENSE", reviewedAt },
      documents: [{ type: "TRADE_LICENSE", fileUrl: "https://private.test/licence.pdf", fileName: "licence.pdf", reviewedBy: "admin-1" }],
      crNumber: "CR-PRIVATE",
      userId: "user-private",
      rating: 4.9,
      commissionRate: 5,
    }));
    expect(dto.seller).toEqual({
      id: "s1", businessNameEn: "Seller", businessNameAr: null, tier: "VERIFIED", city: "Riyadh", country: "SA",
      reviewSummary: { averageRating: null, reviewCount: 0 },
      verification: { type: "TRADE_LICENSE", reviewedAt },
    });
    const serialized = JSON.stringify(dto);
    for (const privateValue of ["documents", "fileUrl", "licence.pdf", "admin-1", "CR-PRIVATE", "user-private", "commissionRate", "4.9"]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it("projects no citation as null, so the page renders no verification mark", () => {
    expect(toCatalogDetailDto(source({})).seller.verification).toBeNull();
    expect(toCatalogDetailDto(source({ verification: null })).seller.verification).toBeNull();
  });
});
