import { describe, expect, it } from "vitest";
import { INDUSTRIAL_DEMO_PART_NUMBERS, reviewedEatonProducts } from "../services/demo-product-enrichment";
import {
  INDUSTRIAL_DEMO_CATEGORIES,
  INDUSTRIAL_DEMO_CURRENCY,
  industrialDemoCategorySlug,
  industrialDemoCommercialFacts,
  industrialDemoSellerIndex,
  validateIndustrialDemoCatalog,
} from "../services/industrial-demo-catalog";

describe("industrial demo catalog contract", () => {
  it("assigns every reviewed manufacturer part to one populated category and one of three sellers", () => {
    expect(validateIndustrialDemoCatalog()).toEqual({
      products: INDUSTRIAL_DEMO_PART_NUMBERS.length,
      categories: 6,
      sellers: 3,
    });
    for (const category of INDUSTRIAL_DEMO_CATEGORIES) {
      expect(category.parts.length).toBeGreaterThan(0);
    }
    for (const part of INDUSTRIAL_DEMO_PART_NUMBERS) {
      expect(industrialDemoCategorySlug(part)).toBeTruthy();
      expect(industrialDemoSellerIndex(part)).toBeGreaterThanOrEqual(0);
      expect(industrialDemoSellerIndex(part)).toBeLessThan(3);
    }
  });

  it("uses an explicit non-AE commercial market and bounded certification stock facts", () => {
    expect(INDUSTRIAL_DEMO_CURRENCY).toBe("SAR");
    for (const part of INDUSTRIAL_DEMO_PART_NUMBERS) {
      const facts = industrialDemoCommercialFacts(part);
      expect(facts.price).toBeGreaterThan(0);
      expect(facts.onHand).toBeGreaterThanOrEqual(facts.reserved);
      expect(facts.reorderPoint).toBeGreaterThan(0);
    }
  });

  it("adds official Eaton circuit-breaker snapshots without inventing manufacturer availability", () => {
    const products = reviewedEatonProducts();
    expect(products).toHaveLength(3);
    for (const product of products) {
      expect(product.manufacturer).toBe("EATON");
      expect(product.sourceUrl).toMatch(/^https:\/\/www\.eaton\.com\/us\/en-us\/skuPage\./);
      expect(product.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(Object.keys(product.specifications).length).toBeGreaterThanOrEqual(8);
      expect(industrialDemoCategorySlug(product.partNumber)).toBe("pilot-circuit-breaker");
    }
  });
});
