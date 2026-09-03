import { describe, expect, it } from "vitest";
import { calculatePromotionDiscount, type PromotionLine } from "../services/promotions";

const lines: PromotionLine[] = [
  {
    key: "a",
    productId: "p-a",
    categoryId: "c-electrical",
    brandId: "b-mennekes",
    sellerId: "s-one",
    quantity: 10,
    baseUnitPrice: 100,
  },
  {
    key: "b",
    productId: "p-b",
    categoryId: "c-safety",
    brandId: "b-3m",
    sellerId: "s-two",
    quantity: 2,
    baseUnitPrice: 250,
  },
];

describe("calculatePromotionDiscount", () => {
  it("applies a percentage only to eligible lines", () => {
    const result = calculatePromotionDiscount(
      {
        id: "promo",
        name: "Electrical 10%",
        type: "PERCENTAGE",
        value: 10,
        minOrderAmount: null,
        maxDiscountAmount: null,
        eligibility: { categoryIds: ["c-electrical"] },
      },
      lines,
    );
    expect(result.discount).toBe(100);
    expect(result.eligibleLineKeys).toEqual(["a"]);
  });

  it("enforces minimum order and maximum discount exposure", () => {
    const result = calculatePromotionDiscount(
      {
        id: "promo",
        name: "Capped",
        type: "PERCENTAGE",
        value: 50,
        minOrderAmount: 1000,
        maxDiscountAmount: 200,
        eligibility: {},
      },
      lines,
    );
    expect(result.discount).toBe(200);
  });

  it("does not apply to another company", () => {
    const result = calculatePromotionDiscount(
      {
        id: "promo",
        name: "Account contract event",
        type: "FIXED_AMOUNT",
        value: 100,
        minOrderAmount: null,
        maxDiscountAmount: null,
        eligibility: { companyIds: ["company-a"] },
      },
      lines,
      "company-b",
    );
    expect(result.discount).toBe(0);
  });

  it("rejects unsafe percentage values instead of over-discounting", () => {
    const result = calculatePromotionDiscount(
      {
        id: "promo",
        name: "Broken",
        type: "PERCENTAGE",
        value: 150,
        minOrderAmount: null,
        maxDiscountAmount: null,
        eligibility: {},
      },
      lines,
    );
    expect(result.discount).toBe(0);
  });
});
