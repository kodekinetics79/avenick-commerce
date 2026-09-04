import { describe, expect, it } from "vitest";
import {
  assertGovernedB2BCheckout,
  assertGenericCheckoutHasNoPurchaseOrder,
  assertMinimumOrderQuantity,
  assertRequiredVariantSelection,
  inventoryStockIdentityWhere,
  resolveConfiguredVatRate,
  composeOrderTotals,
  merchandiseTotalOf,
} from "../services/checkout-invariants";

describe("checkout governance invariants", () => {
  it("rejects direct B2B checkout unless immutable governed PO terms are present", () => {
    expect(() => assertGovernedB2BCheckout("B2B")).toThrow(/governed purchase-order/i);
    expect(() => assertGovernedB2BCheckout("B2B", "po-1", false)).toThrow(/governed purchase-order/i);
    expect(() => assertGovernedB2BCheckout("B2B", "po-1", true)).not.toThrow();
    expect(() => assertGovernedB2BCheckout("B2C")).not.toThrow();
  });
  it("rejects governed purchase orders at the generic cart boundary", () => {
    expect(() => assertGenericCheckoutHasNoPurchaseOrder("po-approved")).toThrow(/governed purchase-order workflow/i);
    expect(() => assertGenericCheckoutHasNoPurchaseOrder()).not.toThrow();
  });

  it("preserves an explicitly configured zero-percent VAT rate", () => {
    expect(resolveConfiguredVatRate(0, 5)).toBe(0);
    expect(resolveConfiguredVatRate("0", 15)).toBe(0);
    expect(resolveConfiguredVatRate(null, 5)).toBe(5);
  });

  it("selects base-SKU stock with an explicit null variant predicate", () => {
    expect(inventoryStockIdentityWhere("product-a")).toEqual({ productId: "product-a", variantId: null });
    expect(inventoryStockIdentityWhere("product-a", "variant-a")).toEqual({
      productId: "product-a",
      variantId: "variant-a",
    });
  });

  it("requires an explicit selection when a product has active variants", () => {
    const variants = [{ id: "active", isActive: true }, { id: "inactive", isActive: false }];
    expect(() => assertRequiredVariantSelection("Safety Boot", variants)).toThrow(/select a product variant/i);
    expect(() => assertRequiredVariantSelection("Safety Boot", variants, "active")).not.toThrow();
    expect(() => assertRequiredVariantSelection("Plain Glove", [], undefined)).not.toThrow();
  });

  it("rejects quantities below the authoritative product MOQ", () => {
    expect(() => assertMinimumOrderQuantity("Bulk Item", 1, 10)).toThrow(/minimum order quantity.*10/i);
    expect(() => assertMinimumOrderQuantity("Bulk Item", 10, 10)).not.toThrow();
  });

  /**
   * The defect: the total was `goods + goodsVat + shipping`, which adds delivery
   * AFTER tax and never taxes it. Delivery this platform prices and charges is
   * part of the consideration for the supply, so it carries the destination's
   * VAT. Every figure on the order agreed with every other while the buyer was
   * undercharged and the persisted vatAmount understated — the kind of wrong
   * answer nothing surfaces on its own.
   */
  describe("order totals", () => {
    it("charges VAT on the delivery at the order's place-of-supply rate", () => {
      // AE: 100 goods + 5 goods VAT + 15 delivery + 0.75 delivery VAT.
      const totals = composeOrderTotals({
        subtotal: 100,
        discountAmount: 0,
        goodsVatAmount: 5,
        shippingAmount: 15,
        vatRatePercent: 5,
      });
      expect(totals.shippingVatAmount).toBe(0.75);
      expect(totals.vatAmount).toBe(5.75);
      expect(totals.total).toBe(120.75);
    });

    it("scales the delivery VAT with the jurisdiction, not the goods", () => {
      // SA at 15%: the freight carries the same statutory rate the goods do.
      const totals = composeOrderTotals({
        subtotal: 200,
        discountAmount: 0,
        goodsVatAmount: 30,
        shippingAmount: 40,
        vatRatePercent: 15,
      });
      expect(totals.shippingVatAmount).toBe(6);
      expect(totals.vatAmount).toBe(36);
      expect(totals.total).toBe(276);
    });

    it("needs no special case for a zero-rated jurisdiction", () => {
      // QA and KW are 0 in the rate table; 0% of the freight is 0, and the
      // total is goods plus delivery with no tax invented anywhere.
      const totals = composeOrderTotals({
        subtotal: 100,
        discountAmount: 0,
        goodsVatAmount: 0,
        shippingAmount: 25,
        vatRatePercent: 0,
      });
      expect(totals.shippingVatAmount).toBe(0);
      expect(totals.vatAmount).toBe(0);
      expect(totals.total).toBe(125);
    });

    it("leaves an order with no delivery exactly as it was", () => {
      // A governed purchase order never gets a freight figure, so its approved
      // total must be untouched by any of this.
      const totals = composeOrderTotals({
        subtotal: 500,
        discountAmount: 50,
        goodsVatAmount: 22.5,
        shippingAmount: 0,
        vatRatePercent: 5,
      });
      expect(totals.shippingVatAmount).toBe(0);
      expect(totals.vatAmount).toBe(22.5);
      expect(totals.total).toBe(472.5);
      expect(merchandiseTotalOf(totals)).toBe(472.5);
    });

    it("keeps the total equal to the lines an invoice prints", () => {
      // Rounding the sum of unrounded parts is how a receipt ends up a fil off
      // from its own rows. Every part is rounded before it is added.
      const totals = composeOrderTotals({
        subtotal: 33.33,
        discountAmount: 3.33,
        goodsVatAmount: 1.5,
        shippingAmount: 12.49,
        vatRatePercent: 5,
      });
      const printed =
        totals.subtotal - totals.discountAmount + totals.goodsVatAmount +
        totals.shippingAmount + totals.shippingVatAmount;
      expect(totals.total).toBe(Number(printed.toFixed(2)));
      expect(totals.vatAmount).toBe(
        Number((totals.goodsVatAmount + totals.shippingVatAmount).toFixed(2)),
      );
    });

    it("taxes the delivery even when the goods are fully discounted", () => {
      // A promotion on the goods is not a promotion on the freight. The
      // delivery is still a supply and still carries its tax.
      const totals = composeOrderTotals({
        subtotal: 100,
        discountAmount: 100,
        goodsVatAmount: 0,
        shippingAmount: 20,
        vatRatePercent: 5,
      });
      expect(totals.shippingVatAmount).toBe(1);
      expect(totals.total).toBe(21);
    });
  });
});
