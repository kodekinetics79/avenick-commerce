import { describe, expect, it } from "vitest";
import {
  resolveStorefrontSelection,
  toStorefrontWishlistItem,
  type StorefrontProduct,
} from "../catalog-commercial";
import { productCardPricePresentation, productCardPurchaseAction, productCardReviewState } from "../product-card-commerce";
import { toWishlistCartLine, wishlistItemKey } from "../../stores/wishlist";
import { summarizeCartCommercial } from "../cart-commercial";
import { toCatalogListDto } from "../catalog-list-dto";

const fallbackProduct: StorefrontProduct = {
  id: "base-priced-product",
  sellerId: "seller",
  sku: "BASE",
  nameEn: "Boot",
  nameAr: "Boot",
  prices: [
    { type: "B2C", currency: "SAR", minQty: 1, maxQty: null, price: 80, vatRate: 0 },
    { type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 100, vatRate: 15 },
  ],
  inventory: [{ inStock: false }],
  variants: [{
    id: "blue-42",
    sku: "BLUE-42",
    nameEn: "Blue / 42",
    nameAr: null,
    attributes: { color: "blue", size: 42 },
    prices: [],
    inStock: true,
  }],
};

describe("variant wishlist, list card, and base-price fallback", () => {
  it("matches checkout base-price fallback with exact selected currency and VAT", () => {
    const selection = resolveStorefrontSelection(fallbackProduct, "blue-42", 2, "AED");
    expect(selection).toMatchObject({
      variantId: "blue-42",
      sku: "BLUE-42",
      currency: "AED",
      unitPrice: 100,
      vatRate: 15,
      vatPerUnit: 15,
      grossTotal: 230,
      inStock: true,
    });

    const checkoutRequest = {
      currency: selection!.currency,
      items: [{ productId: fallbackProduct.id, variantId: selection!.variantId, quantity: 2 }],
    };
    expect(checkoutRequest).toEqual({
      currency: "AED",
      items: [{ productId: "base-priced-product", variantId: "blue-42", quantity: 2 }],
    });
  });

  it("falls back when a variant has prices but no applicable checkout tier", () => {
    const product = structuredClone(fallbackProduct);
    product.variants[0]!.prices = [
      { type: "B2C", currency: "SAR", minQty: 10, maxQty: null, price: 70, vatRate: 0 },
    ];
    expect(resolveStorefrontSelection(product, "blue-42", 2, "AED")).toMatchObject({
      currency: "AED",
      unitPrice: 100,
      vatRate: 15,
      grossTotal: 230,
    });
  });

  it("preserves selector identity and commercial facts through wishlist to cart", () => {
    const selection = resolveStorefrontSelection(fallbackProduct, "blue-42", 1, "SAR")!;
    const wishlist = toStorefrontWishlistItem(fallbackProduct, "boot", selection, 1, "/boot.png");
    expect(wishlist).toMatchObject({
      id: "base-priced-product",
      variantId: "blue-42",
      sku: "BLUE-42",
      price: 80,
      vatRate: 0,
      currency: "SAR",
    });
    expect(wishlistItemKey(wishlist.id, wishlist.variantId)).toBe("base-priced-product-blue-42");
    expect(toWishlistCartLine(wishlist)).toMatchObject({
      productId: "base-priced-product",
      variantId: "blue-42",
      sku: "BLUE-42",
      unitPrice: 80,
      vatRate: 0,
      currency: "SAR",
      qty: 1,
    });
  });

  it("preserves a quantity-10 variant tier and exact zero-VAT checkout facts", () => {
    const product = structuredClone(fallbackProduct);
    product.variants[0]!.prices = [
      { type: "B2C", currency: "SAR", minQty: 10, maxQty: null, price: 70, vatRate: 0 },
    ];
    const selection = resolveStorefrontSelection(product, "blue-42", 10, "SAR")!;
    const wishlist = toStorefrontWishlistItem(product, "boot", selection, 10);
    const cartLine = toWishlistCartLine(wishlist);
    expect(cartLine).toMatchObject({ qty: 10, unitPrice: 70, currency: "SAR", vatRate: 0 });
    expect(summarizeCartCommercial([cartLine])).toEqual({
      valid: true, currency: "SAR", subtotal: 700, vatAmount: 0, total: 700,
    });
    expect({ currency: cartLine.currency, items: [{ productId: cartLine.productId, variantId: cartLine.variantId, quantity: cartLine.qty }] })
      .toEqual({ currency: "SAR", items: [{ productId: "base-priced-product", variantId: "blue-42", quantity: 10 }] });
  });

  it("publishes a truthful SAR variant-only card price without exposing variant topology", () => {
    const dto = toCatalogListDto({
      id: "p", sellerId: "s", sku: "P", slug: "p", nameEn: "P", nameAr: "P",
      descriptionEn: null, descriptionAr: null, origin: null, tags: [], moq: 1,
      isB2CEnabled: true, isB2BEnabled: false, images: [], prices: [], inventory: [{ qty: 2, reservedQty: 0 }],
      variants: [{ id: "private-topology-id", prices: [
        { type: "B2C", currency: "SAR", minQty: 1, maxQty: null, price: 125, vatRate: 15 },
      ] }],
      category: { nameEn: "C", nameAr: "C", slug: "c" }, brand: null,
      seller: { businessNameEn: "S", businessNameAr: null, tier: "VERIFIED", rating: 0 },
    }, "B2C");
    expect(dto.cardPrice).toEqual({ amount: 125, currency: "SAR", vatRate: 15, isFrom: true });
    expect(productCardPricePresentation(dto.cardPrice.amount, dto.hasVariants)).toBe("FROM");
    expect(dto).not.toHaveProperty("variants");
  });

  it("fails closed for mixed currencies and never invents reviews", () => {
    expect(summarizeCartCommercial([
      { unitPrice: 10, qty: 1, currency: "SAR", vatRate: 0 },
      { unitPrice: 10, qty: 1, currency: "AED", vatRate: 5 },
    ])).toEqual({ valid: false, reason: "MIXED_CURRENCY" });
    expect(productCardReviewState(undefined, 0)).toEqual({ kind: "UNRATED" });
  });

  it("requires navigation to variant selection instead of ambiguous quick-add", () => {
    expect(productCardPurchaseAction(true)).toBe("SELECT_VARIANT");
    expect(productCardPurchaseAction(false)).toBe("ADD_TO_CART");
  });
});
