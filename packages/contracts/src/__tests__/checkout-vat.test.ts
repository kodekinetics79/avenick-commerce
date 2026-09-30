import { describe, expect, it } from "vitest";

import { CheckoutQuoteSchema, OrderTotalsSchema, merchandiseTotalOf } from "../checkout";
import { PersistedOrderTotalsSchema } from "../orders";

/**
 * The defect this suite exists for: VAT charged on the goods and not on the
 * delivery (fixed in PR #21). A contract with one `vatAmount` field lets it
 * back in silently, because a collapsed figure and a correct one are the same
 * type. These tests assert that the contract itself refuses the collapse.
 */

/** An AE order: 5% VAT, 100 of goods, 20 of delivery. */
const validTotals = {
  subtotal: 100,
  discountAmount: 0,
  goodsVatAmount: 5,
  shippingAmount: 20,
  shippingVatAmount: 1,
  vatAmount: 6,
  total: 126,
};

describe("OrderTotals mirrors composeOrderTotals", () => {
  it("round-trips the totals of a real AE order", () => {
    expect(OrderTotalsSchema.parse(validTotals)).toEqual(validTotals);
  });

  it("carries exactly the seven fields composeOrderTotals returns", () => {
    expect(Object.keys(OrderTotalsSchema.innerType().shape).sort()).toEqual([
      "discountAmount",
      "goodsVatAmount",
      "shippingAmount",
      "shippingVatAmount",
      "subtotal",
      "total",
      "vatAmount",
    ]);
  });

  it("CANNOT be constructed without goodsVatAmount", () => {
    const { goodsVatAmount: _omitted, ...withoutGoodsVat } = validTotals;
    const result = OrderTotalsSchema.safeParse(withoutGoodsVat);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.join(".") === "goodsVatAmount")).toBe(true);
  });

  it("CANNOT be constructed without shippingVatAmount", () => {
    const { shippingVatAmount: _omitted, ...withoutShippingVat } = validTotals;
    const result = OrderTotalsSchema.safeParse(withoutShippingVat);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.join(".") === "shippingVatAmount")).toBe(true);
  });

  it("rejects null for either VAT component — absent and zero are different claims", () => {
    expect(OrderTotalsSchema.safeParse({ ...validTotals, shippingVatAmount: null }).success).toBe(false);
    expect(OrderTotalsSchema.safeParse({ ...validTotals, goodsVatAmount: null }).success).toBe(false);
  });

  it("rejects the exact pre-PR-21 arithmetic: VAT on goods only, freight added after tax", () => {
    // total = subtotal + goodsVat + shipping, and vatAmount = goodsVat.
    const preFix = {
      subtotal: 100,
      discountAmount: 0,
      goodsVatAmount: 5,
      shippingAmount: 20,
      shippingVatAmount: 1,
      vatAmount: 5,
      total: 125,
    };
    const result = OrderTotalsSchema.safeParse(preFix);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["vatAmount", "total"]),
    );
  });

  it("rejects a total that adds delivery after tax even when the VAT components are right", () => {
    expect(OrderTotalsSchema.safeParse({ ...validTotals, total: 125 }).success).toBe(false);
  });

  it("accepts a zero-rated jurisdiction without a special case", () => {
    // QA and KW carry rate 0, so 0% of the freight is 0 — and the fields are
    // still both present, which is what distinguishes zero-rated from untaxed.
    const qatar = {
      subtotal: 100,
      discountAmount: 10,
      goodsVatAmount: 0,
      shippingAmount: 20,
      shippingVatAmount: 0,
      vatAmount: 0,
      total: 110,
    };
    expect(OrderTotalsSchema.parse(qatar)).toEqual(qatar);
  });

  it("applies the discount to the goods before tax and to the total once", () => {
    // SA, 15%: 200 goods less 20 discount, VAT 27 on the discounted goods,
    // 30 delivery carrying 4.5.
    const saudi = {
      subtotal: 200,
      discountAmount: 20,
      goodsVatAmount: 27,
      shippingAmount: 30,
      shippingVatAmount: 4.5,
      vatAmount: 31.5,
      total: 241.5,
    };
    expect(OrderTotalsSchema.parse(saudi)).toEqual(saudi);
    expect(merchandiseTotalOf(saudi)).toBe(207);
  });

  it("rejects a third decimal place, which the server's money() can never produce", () => {
    expect(OrderTotalsSchema.safeParse({ ...validTotals, shippingVatAmount: 1.005 }).success).toBe(false);
  });

  it("refuses an extra field, so no route can append its own VAT-looking figure", () => {
    expect(OrderTotalsSchema.safeParse({ ...validTotals, taxAmount: 6 }).success).toBe(false);
  });
});

describe("the quote response as a whole", () => {
  const quote = {
    quoteId: "qt_01HZX",
    currency: "AED" as const,
    channel: "B2C" as const,
    vatRatePercent: 5,
    lines: [
      {
        productId: "prod_1",
        variantId: null,
        sellerId: "sel_1",
        sku: "SKU-1",
        nameEn: "Nitrile gloves, box of 100",
        nameAr: "قفازات نتريل، علبة 100",
        quantity: 2,
        unitPrice: 50,
        vatRatePercent: 5,
        vatAmount: 5,
        lineTotal: 100,
      },
    ],
    shipping: {
      status: "priced" as const,
      zoneName: "UAE mainland",
      amount: 20,
      vatRatePercent: 5,
      estimatedDaysMin: 2,
      estimatedDaysMax: 4,
    },
    promotions: [],
    totals: validTotals,
    expiresAt: "2026-09-05T12:00:00Z",
  };

  it("round-trips a complete quote", () => {
    expect(CheckoutQuoteSchema.parse(quote)).toEqual(quote);
  });

  it("cannot be constructed with a collapsed VAT figure inside it", () => {
    const collapsed = { ...quote, totals: { ...validTotals, vatAmount: 5, total: 125 } };
    expect(CheckoutQuoteSchema.safeParse(collapsed).success).toBe(false);
  });

  it("cannot be constructed with the VAT components missing from totals", () => {
    const { goodsVatAmount: _g, shippingVatAmount: _s, ...collapsedTotals } = validTotals;
    expect(CheckoutQuoteSchema.safeParse({ ...quote, totals: collapsedTotals }).success).toBe(false);
  });

  it("distinguishes 'no zones configured' from 'we do not ship there'", () => {
    const noZones = { ...quote, shipping: { ...quote.shipping, status: "unpriced_no_zones" as const, zoneName: null } };
    expect(CheckoutQuoteSchema.parse(noZones).shipping.status).toBe("unpriced_no_zones");
    const unavailable = { ...quote, shipping: { ...quote.shipping, status: "unavailable" as const, zoneName: null } };
    expect(CheckoutQuoteSchema.parse(unavailable).shipping.status).toBe("unavailable");
    expect(CheckoutQuoteSchema.safeParse({ ...quote, shipping: { ...quote.shipping, status: "free" } }).success).toBe(false);
  });

  it("requires an expiry, so no screen can show a quote that has stopped being the price", () => {
    const { expiresAt: _omitted, ...withoutExpiry } = quote;
    expect(CheckoutQuoteSchema.safeParse(withoutExpiry).success).toBe(false);
  });
});

describe("totals ON A PLACED ORDER are honest about what is stored", () => {
  const persisted = {
    subtotal: 100,
    discountAmount: 0,
    shippingAmount: 20,
    vatAmount: 6,
    goodsVatAmount: null,
    shippingVatAmount: null,
    total: 126,
  };

  it("accepts an order whose VAT components were never persisted", () => {
    expect(PersistedOrderTotalsSchema.parse(persisted)).toEqual(persisted);
  });

  it("still enforces the identity when both components are present", () => {
    expect(
      PersistedOrderTotalsSchema.safeParse({ ...persisted, goodsVatAmount: 5, shippingVatAmount: 1 }).success,
    ).toBe(true);
    expect(
      PersistedOrderTotalsSchema.safeParse({ ...persisted, goodsVatAmount: 5, shippingVatAmount: 5 }).success,
    ).toBe(false);
  });

  it("refuses one component alone, which invites the reader to infer the other and be wrong", () => {
    expect(PersistedOrderTotalsSchema.safeParse({ ...persisted, goodsVatAmount: 5 }).success).toBe(false);
    expect(PersistedOrderTotalsSchema.safeParse({ ...persisted, shippingVatAmount: 1 }).success).toBe(false);
  });
});
