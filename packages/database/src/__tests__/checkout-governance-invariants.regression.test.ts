import { describe, expect, it } from "vitest";
import {
  assertGovernedB2BCheckout,
  assertGenericCheckoutHasNoPurchaseOrder,
  assertMinimumOrderQuantity,
  assertRequiredVariantSelection,
  inventoryStockIdentityWhere,
  resolveConfiguredVatRate,
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
});
