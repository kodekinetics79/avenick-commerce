import { describe, expect, it, vi } from "vitest";
import { loadHomeRails } from "../home-rails";

/**
 * A storefront row in the shape listProducts actually returns — the same shape
 * the privacy DTO test uses. A thinner fixture passes the loader and tells you
 * nothing about whether the DTO can read it.
 */
function row(id: string) {
  return {
    id, sellerId: "seller", sku: id.toUpperCase(), slug: id, nameEn: id, nameAr: id,
    descriptionEn: null, descriptionAr: null, origin: "AE", tags: [], moq: 1,
    isPubliclyDiscoverable: true, isB2CEnabled: true, isB2BEnabled: false,
    images: [{ url: "https://image.test/p.png", altText: null }],
    prices: [{ type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 10, vatRate: 5 }],
    inventory: [{ variantId: null, qty: 5, reservedQty: 0 }],
    variants: [],
    category: { nameEn: "Category", nameAr: "Category", slug: "category" },
    brand: null,
    seller: { businessNameEn: "Seller", businessNameAr: null, tier: "VERIFIED", rating: 5 },
    rating: { average: 4.5, count: 12 },
  };
}

const sections = () =>
  Promise.resolve({
    bestSellers: [row("a")],
    newArrivals: [row("b")],
    topRated: [row("c")],
    featured: [row("d")],
  });

describe("loadHomeRails", () => {
  it("returns every rail when all sources answer", async () => {
    const rails = await loadHomeRails({
      sections: sections as any,
      brands: (() => Promise.resolve([{ id: "brand" }])) as any,
      trending: (() => Promise.resolve([row("t")])) as any,
    });
    expect(rails.bestSellers).toHaveLength(1);
    expect(rails.trending).toHaveLength(1);
    expect(rails.brands).toHaveLength(1);
    // The DTO ran: the card carries a price and the review aggregate survived it.
    expect(rails.bestSellers[0]!["cardPrice"]).toMatchObject({ amount: 10, currency: "AED" });
    expect(rails.bestSellers[0]!["rating"]).toEqual({ average: 4.5, count: 12 });
  });

  /**
   * The defect this test exists for: the three reads used to share one
   * Promise.all, so a trend query against a database with no ProductViewSignal
   * table rejected the combined promise and the page rendered SIX empty rails —
   * an entirely productless storefront caused by an optional signal.
   */
  it("keeps the catalogue when the trend signal is unavailable", async () => {
    const onError = vi.fn();
    const rails = await loadHomeRails({
      sections: sections as any,
      brands: (() => Promise.resolve([{ id: "brand" }])) as any,
      trending: (() => Promise.reject(new Error("The table `public.ProductViewSignal` does not exist"))) as any,
      onError,
    });
    expect(rails.bestSellers).toHaveLength(1);
    expect(rails.newArrivals).toHaveLength(1);
    expect(rails.topRated).toHaveLength(1);
    expect(rails.featured).toHaveLength(1);
    expect(rails.trending).toEqual([]);
    expect(onError).toHaveBeenCalledWith("trending", expect.any(Error));
  });

  it("keeps the catalogue when the brand strip is unavailable", async () => {
    const rails = await loadHomeRails({
      sections: sections as any,
      brands: (() => Promise.reject(new Error("no brands"))) as any,
      trending: (() => Promise.resolve([])) as any,
    });
    expect(rails.bestSellers).toHaveLength(1);
    expect(rails.brands).toEqual([]);
  });

  it("empties the product rails only when the catalogue itself fails", async () => {
    const onError = vi.fn();
    const rails = await loadHomeRails({
      sections: (() => Promise.reject(new Error("catalogue down"))) as any,
      brands: (() => Promise.resolve([{ id: "brand" }])) as any,
      trending: (() => Promise.resolve([row("t")])) as any,
      onError,
    });
    expect(rails.bestSellers).toEqual([]);
    expect(rails.trending).toEqual([]);
    // The brand strip still answered, so it is still shown.
    expect(rails.brands).toHaveLength(1);
    expect(onError).toHaveBeenCalledWith("sections", expect.any(Error));
  });
});
