import { describe, expect, it } from "vitest";
import { resolveStorefrontSelection, toStorefrontCartLine, type StorefrontProduct } from "../catalog-commercial";

const product: StorefrontProduct = {
  id: "product",
  slug: "variant-product",
  sellerId: "seller",
  sku: "BASE",
  nameEn: "Variant-only product",
  nameAr: "Variant-only product",
  prices: [],
  inventory: [{ inStock: false, availableQty: 0 }],
  variants: [
    {
      id: "zero-sar", sku: "ZERO-SAR", nameEn: "Zero rated", nameAr: null,
      attributes: { size: "S" }, inStock: true, availableQty: 2,
      prices: [{ type: "B2C", currency: "SAR", minQty: 1, maxQty: null, price: 100, vatRate: 0 }],
    },
    {
      id: "standard-aed", sku: "STANDARD-AED", nameEn: "Standard rated", nameAr: null,
      attributes: { size: "L" }, inStock: false, availableQty: 0,
      prices: [{ type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 200, vatRate: 15 }],
    },
  ],
};

describe("variant storefront commercial journey", () => {
  it("carries variant-only selector, exact availability, currency and zero VAT through cart and checkout", () => {
    const selection = resolveStorefrontSelection(product, "zero-sar", 2);
    expect(selection).toMatchObject({
      variantId: "zero-sar", sku: "ZERO-SAR", inStock: true,
      currency: "SAR", unitPrice: 100, vatRate: 0, vatPerUnit: 0, grossTotal: 200,
    });
    const cartLine = toStorefrontCartLine(product, selection!, 2);
    expect(cartLine).toMatchObject({ productId: "product", variantId: "zero-sar", currency: "SAR", vatRate: 0 });
    const checkout = {
      currency: cartLine.currency,
      items: [{ productId: cartLine.productId, variantId: cartLine.variantId, quantity: cartLine.qty }],
    };
    expect(checkout).toEqual({
      currency: "SAR",
      items: [{ productId: "product", variantId: "zero-sar", quantity: 2 }],
    });
  });

  it("does not borrow another variant's stock and applies its exact 15% VAT", () => {
    expect(resolveStorefrontSelection(product, "standard-aed", 1)).toMatchObject({
      variantId: "standard-aed", inStock: false, currency: "AED",
      unitPrice: 200, vatRate: 15, vatPerUnit: 30, grossTotal: 230,
    });
    expect(resolveStorefrontSelection(product, undefined, 1)).toBeNull();
  });

  it("bounds selected availability by aggregate quantity", () => {
    expect(resolveStorefrontSelection(product, "zero-sar", 2, "SAR")).toMatchObject({ inStock: true, availableQty: 2 });
    expect(resolveStorefrontSelection(product, "zero-sar", 3, "SAR")).toMatchObject({ inStock: false, availableQty: 2 });
  });
});
