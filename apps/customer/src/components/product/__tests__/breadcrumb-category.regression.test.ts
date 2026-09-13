import { describe, expect, it } from "vitest";
import { toCatalogDetailDto, type CatalogDetailSource } from "@/lib/catalog-detail-dto";
import { breadcrumbCategory } from "../product-facts";

/**
 * The product breadcrumb names the product's category.
 *
 * THE DEFECT. The trail read "Home › Products › <product>" on every product
 * page. The detail service already loads the category (`category: true`), but
 * the detail DTO dropped it, so a buyer who arrived from search or a shared link
 * had no way up to the shelf the product sits on, even though /categories/[slug]
 * exists for exactly that.
 *
 * What these hold: the DTO carries the category's slug and names only, not the
 * whole row; the crumb links to the category page only when that page will exist
 * (an active category, under a publicly discoverable product, which is what the
 * public category tree requires); and it is omitted when it would just repeat the
 * product's own name, which is the case on the very product the review looked at
 * ("Wire & Cable Lubricants › Wire & Cable Lubricants").
 */

const source = (overrides: Record<string, unknown>) => ({
  id: "p", sellerId: "s", sku: "P", slug: "p", nameEn: "Busbar 400 A", nameAr: "Busbar 400 A",
  descriptionEn: null, descriptionAr: null, isPubliclyDiscoverable: true, isB2CEnabled: false, isB2BEnabled: true,
  origin: null, weight: null, moq: 1, images: [], prices: [], inventory: [], variants: [], reviews: [],
  seller: { id: "s", businessNameEn: "S", businessNameAr: null, tier: "STANDARD", city: "Riyadh", country: "SA", reviewSummary: { averageRating: null, reviewCount: 0 } },
  ...overrides,
}) as unknown as CatalogDetailSource;

const category = {
  id: "cat-private-id", parentId: "parent-private-id", slug: "pilot-busbars", nameEn: "Busbars", nameAr: "قضبان التوزيع",
  imageUrl: "https://private.test/cat.png", iconName: "bolt", sortOrder: 3, isActive: true,
};

describe("catalog detail category projection", () => {
  it("carries the slug and both names, and nothing else from the row", () => {
    const dto = toCatalogDetailDto(source({ category }));
    expect(dto.category).toEqual({ slug: "pilot-busbars", nameEn: "Busbars", nameAr: "قضبان التوزيع" });
    expect(JSON.stringify(dto)).not.toContain("private-id");
  });

  it("carries no category that has no page to link to", () => {
    expect(toCatalogDetailDto(source({ category: { ...category, isActive: false } })).category).toBeNull();
    expect(toCatalogDetailDto(source({ category: null })).category).toBeNull();
    expect(toCatalogDetailDto(source({})).category).toBeNull();
  });
});

describe("breadcrumbCategory", () => {
  const product = { isPubliclyDiscoverable: true, category: { slug: "pilot-busbars", nameEn: "Busbars", nameAr: "قضبان التوزيع" } };

  it("links the category in the reader's language", () => {
    expect(breadcrumbCategory(product, "Busbar 400 A", "en")).toEqual({ href: "/categories/pilot-busbars", name: "Busbars" });
    expect(breadcrumbCategory(product, "Busbar 400 A", "ar")).toEqual({ href: "/categories/pilot-busbars", name: "قضبان التوزيع" });
  });

  it("falls back to the English name when the Arabic one is empty", () => {
    expect(breadcrumbCategory({ ...product, category: { ...product.category, nameAr: "  " } }, "Busbar 400 A", "ar")?.name).toBe("Busbars");
  });

  it("is omitted when it would only repeat the product's own name", () => {
    const echo = { isPubliclyDiscoverable: true, category: { slug: "wcl", nameEn: "Wire & Cable Lubricants", nameAr: "Wire & Cable Lubricants" } };
    expect(breadcrumbCategory(echo, "Wire & Cable Lubricants", "en")).toBeNull();
    expect(breadcrumbCategory(echo, " wire & cable lubricants ", "en")).toBeNull();
  });

  it("is omitted when the category page would not list this product", () => {
    expect(breadcrumbCategory({ ...product, isPubliclyDiscoverable: false }, "Busbar 400 A", "en")).toBeNull();
    expect(breadcrumbCategory({ isPubliclyDiscoverable: true, category: null }, "Busbar 400 A", "en")).toBeNull();
  });
});
