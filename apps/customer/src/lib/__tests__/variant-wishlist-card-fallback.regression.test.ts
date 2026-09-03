import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveStorefrontSelection,
  toStorefrontWishlistItem,
  type StorefrontProduct,
} from "../catalog-commercial";
import { productCardPricePresentation, productCardPurchaseAction, productCardReviewState, storefrontProductHref } from "../product-card-commerce";
import { toWishlistCartLine, wishlistItemKey, type WishlistItem } from "../../stores/wishlist";
import { cartLineNeedsRepricing, cartQuantityChangeHref, replaceCartCommercialSelection, useCartStore } from "../../stores/cart";
import { defaultStorefrontCurrency } from "../market-context";
import { cartDestination, summarizeCartCommercial } from "../cart-commercial";
import { toCatalogListDto } from "../catalog-list-dto";
import { canonicalRequisitionCartLines } from "../requisition-reprice";

const fallbackProduct: StorefrontProduct = {
  id: "base-priced-product",
  slug: "boot",
  sellerId: "seller",
  sku: "BASE",
  nameEn: "Boot",
  nameAr: "Boot",
  prices: [
    { type: "B2C", currency: "SAR", minQty: 1, maxQty: null, price: 80, vatRate: 0 },
    { type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 100, vatRate: 15 },
  ],
  inventory: [{ inStock: false, availableQty: 0 }],
  variants: [{
    id: "blue-42",
    sku: "BLUE-42",
    nameEn: "Blue / 42",
    nameAr: null,
    attributes: { color: "blue", size: 42 },
    prices: [],
    inStock: true,
    availableQty: 20,
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
    const wishlist = toStorefrontWishlistItem(fallbackProduct, "boot", selection, 1, "B2C", "/boot.png");
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
    product.moq = 10;
    const selection = resolveStorefrontSelection(product, "blue-42", 20, "SAR")!;
    const wishlist = toStorefrontWishlistItem(product, "boot", selection, 20);
    const cartLine = toWishlistCartLine(wishlist);
    expect(cartLine).toMatchObject({ qty: 20, moq: 10, unitPrice: 70, currency: "SAR", vatRate: 0 });
    expect(summarizeCartCommercial([cartLine])).toEqual({
      valid: true, currency: "SAR", subtotal: 1400, vatAmount: 0, total: 1400,
    });
    expect({ currency: cartLine.currency, items: [{ productId: cartLine.productId, variantId: cartLine.variantId, quantity: cartLine.qty }] })
      .toEqual({ currency: "SAR", items: [{ productId: "base-priced-product", variantId: "blue-42", quantity: 20 }] });
    expect(cartLine).toMatchObject({ slug: "boot", moq: 10 });
    expect(cartQuantityChangeHref(cartLine)).toBe("/products/boot?currency=SAR&variantId=blue-42&qty=20");
  });

  it("replaces a 10-unit commercial snapshot after product re-selection at a 20-unit tier", () => {
    const prior = { id: "p-v", productId: "p", slug: "p", variantId: "v", nameEn: "P", nameAr: "P", sku: "V", qty: 10, moq: 10, unitPrice: 100, vatRate: 5, sellerId: "s", currency: "AED" };
    const selected = { productId: "p", slug: "p", variantId: "v", nameEn: "P", nameAr: "P", sku: "V", qty: 20, moq: 10, unitPrice: 80, vatRate: 0, sellerId: "s", currency: "AED" };
    expect(replaceCartCommercialSelection(prior, selected)).toMatchObject({ id: "p-v", qty: 20, unitPrice: 80, vatRate: 0 });
  });

  it("keeps channel price visibility independent from authoritative availability", () => {
    const dto = toCatalogListDto({
      id: "p", sellerId: "s", sku: "P", slug: "p", nameEn: "P", nameAr: "P",
      descriptionEn: null, descriptionAr: null, origin: null, tags: [], moq: 1,
      isPubliclyDiscoverable: true, isB2CEnabled: true, isB2BEnabled: false, images: [], prices: [], inventory: [
        { variantId: "cheap", qty: 0, reservedQty: 0 }, { variantId: "available", qty: 2, reservedQty: 0 },
      ],
      variants: [
        { id: "cheap", prices: [{ type: "B2C", currency: "SAR", minQty: 1, maxQty: null, price: 20, vatRate: 0 }] },
        { id: "available", prices: [{ type: "B2C", currency: "SAR", minQty: 1, maxQty: null, price: 90, vatRate: 15 }] },
      ],
      category: { nameEn: "C", nameAr: "C", slug: "c" }, brand: null,
      seller: { businessNameEn: "S", businessNameAr: null, tier: "VERIFIED", rating: 0 },
    }, "B2C");
    expect(dto.cardPrice).toEqual({ amount: 20, currency: "SAR", vatRate: 0, isFrom: true });
  });

  it("publishes a truthful SAR variant-only card price without exposing variant topology", () => {
    const dto = toCatalogListDto({
      id: "p", sellerId: "s", sku: "P", slug: "p", nameEn: "P", nameAr: "P",
      descriptionEn: null, descriptionAr: null, origin: null, tags: [], moq: 1,
      isPubliclyDiscoverable: true, isB2CEnabled: true, isB2BEnabled: false, images: [], prices: [], inventory: [{ variantId: "private-topology-id", qty: 2, reservedQty: 0 }],
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
    expect(productCardPurchaseAction(false, false)).toBe("REQUEST_AVAILABILITY");
  });

  it("accepts only a complete canonical requisition basket before cart mutation", () => {
    const line = { productId: "p", slug: "p", nameEn: "P", nameAr: "P", sku: "P", qty: 10, moq: 10, unitPrice: 8, vatRate: 15, sellerId: "s", currency: "SAR", channel: "B2B" as const };
    expect(canonicalRequisitionCartLines(1, { currency: "SAR", lines: [line] })).toEqual([line]);
    expect(() => canonicalRequisitionCartLines(2, { currency: "SAR", lines: [line] })).toThrow(/incomplete/i);
    expect(() => canonicalRequisitionCartLines(1, { currency: "AED", lines: [line] })).toThrow(/incomplete/i);
  });

  it("routes a canonical B2B requisition basket only to governed PO creation", () => {
    const b2bLine = { productId: "p", slug: "b2b-only", variantId: "v", nameEn: "P", nameAr: "P", sku: "V", qty: 10, moq: 10, unitPrice: 8, vatRate: 15, sellerId: "s", currency: "SAR", channel: "B2B" as const };
    const lines = canonicalRequisitionCartLines(1, { currency: "SAR", lines: [b2bLine] });

    expect(cartDestination(lines)).toEqual({
      valid: true,
      href: "/b2b/purchase-orders/new",
      label: "Create purchase order",
    });
    expect(storefrontProductHref(b2bLine.slug, {
      currency: lines[0]!.currency,
      b2b: true,
      variantId: lines[0]!.variantId,
      quantity: lines[0]!.qty,
    })).toBe("/products/b2b-only?currency=SAR&b2b=true&variantId=v&qty=10");
  });

  it("routes B2C to checkout and fails closed for mixed or legacy channels", () => {
    const commercial = { unitPrice: 10, qty: 1, currency: "AED", vatRate: 5 };
    expect(cartDestination([{ ...commercial, channel: "B2C" }])).toEqual({
      valid: true,
      href: "/checkout",
      label: "Proceed to Checkout",
    });
    expect(cartDestination([
      { ...commercial, channel: "B2C" },
      { ...commercial, channel: "B2B" },
    ])).toEqual({ valid: false, reason: "MIXED_OR_UNKNOWN_CHANNEL" });
    expect(cartDestination([commercial])).toEqual({ valid: false, reason: "MIXED_OR_UNKNOWN_CHANNEL" });
  });

  it("keeps advertised currency reachable and resolves own-tier then base fallback deterministically", () => {
    const dto = toCatalogListDto({
      id: "p", sellerId: "s", sku: "P", slug: "multi", nameEn: "P", nameAr: "P",
      descriptionEn: null, descriptionAr: null, origin: null, tags: [], moq: 10,
      isPubliclyDiscoverable: true, isB2CEnabled: true, isB2BEnabled: false, images: [],
      prices: [{ type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 100, vatRate: 5 }],
      inventory: [{ variantId: "sar-own", qty: 10, reservedQty: 0 }, { variantId: "base-fallback", qty: 10, reservedQty: 0 }],
      variants: [
        { id: "sar-own", prices: [{ type: "B2C", currency: "SAR", minQty: 1, maxQty: null, price: 20, vatRate: 15 }] },
        { id: "base-fallback", prices: [] },
      ],
      category: { nameEn: "C", nameAr: "C", slug: "c" }, brand: null,
      seller: { businessNameEn: "S", businessNameAr: null, tier: "VERIFIED", rating: 0 },
    }, "B2C");
    expect(dto.cardPrice).toEqual({ amount: 100, currency: "AED", vatRate: 5, isFrom: true });
    expect(storefrontProductHref(dto.slug, { currency: dto.cardPrice.currency })).toBe("/products/multi?currency=AED");
    expect(storefrontProductHref(dto.slug, { currency: "SAR", b2b: true, variantId: "v", quantity: 20 }))
      .toBe("/products/multi?currency=SAR&b2b=true&variantId=v&qty=20");
  });
});

/**
 * A seller who publishes more than one price band makes the unit price a
 * function of quantity. The product page already flags such lines so the
 * cart sends a quantity change back through the catalog; the list card and
 * the wishlist add lines without visiting that page and used to drop the
 * flag, so the cart edited the line in place at whatever tier it was added
 * at — a total the server never charges.
 */
describe("tiered prices reach the cart from the grid and the wishlist", () => {
  const listSource = {
    id: "tiered", sellerId: "s", sku: "T", slug: "tiered", nameEn: "Tiered", nameAr: "Tiered",
    descriptionEn: null, descriptionAr: null, origin: null, tags: [], moq: 1,
    isPubliclyDiscoverable: true, isB2CEnabled: true, isB2BEnabled: false, images: [],
    prices: [
      { type: "B2C", currency: "AED", minQty: 1, maxQty: 9, price: 100, vatRate: 5 },
      { type: "B2C", currency: "AED", minQty: 10, maxQty: null, price: 80, vatRate: 5 },
    ],
    inventory: [{ variantId: null, qty: 50, reservedQty: 0 }],
    variants: [],
    category: { nameEn: "C", nameAr: "C", slug: "c" }, brand: null,
    seller: { businessNameEn: "S", businessNameAr: null, tier: "VERIFIED", rating: 0 },
  };

  // The card copies the DTO's facts into a cart line or a wishlist item the
  // same way product-card.tsx does; this is that projection without React.
  const cardLineFrom = (dto: ReturnType<typeof toCatalogListDto>) => ({
    productId: dto.id, slug: dto.slug, channel: "B2C" as const, nameEn: dto.nameEn, nameAr: dto.nameAr,
    sku: dto.sku, qty: dto.moq, moq: dto.moq, unitPrice: dto.cardPrice!.amount, vatRate: dto.cardPrice!.vatRate,
    priceTiered: dto.priceTiered, sellerId: dto.sellerId, currency: dto.cardPrice!.currency,
  });
  const cardWishlistFrom = (dto: ReturnType<typeof toCatalogListDto>): WishlistItem => ({
    id: dto.id, slug: dto.slug, channel: "B2C", nameEn: dto.nameEn, nameAr: dto.nameAr,
    price: dto.cardPrice!.amount, quantity: dto.moq, moq: dto.moq, vatRate: dto.cardPrice!.vatRate,
    priceTiered: dto.priceTiered, currency: dto.cardPrice!.currency, sku: dto.sku, sellerId: dto.sellerId, inStock: true,
  });

  it("flags a multi-band product on the list DTO and carries it through the card's add-to-cart", () => {
    const dto = toCatalogListDto(listSource, "B2C", "AED");
    expect(dto.priceTiered).toBe(true);
    expect(dto.cardPrice).toEqual({ amount: 100, currency: "AED", vatRate: 5, isFrom: false });
    const line = cardLineFrom(dto);
    expect(line.priceTiered).toBe(true);
    expect(cartLineNeedsRepricing(line)).toBe(true);
  });

  it("carries the flag from the card's wishlist toggle through toWishlistCartLine", () => {
    const dto = toCatalogListDto(listSource, "B2C", "AED");
    const line = toWishlistCartLine(cardWishlistFrom(dto));
    expect(line).toMatchObject({ productId: "tiered", unitPrice: 100, currency: "AED", priceTiered: true });
    expect(cartLineNeedsRepricing(line)).toBe(true);
  });

  it("carries the flag from the product page's wishlist path the same way", () => {
    const product: StorefrontProduct = {
      id: "tiered", slug: "tiered", sellerId: "s", sku: "T", nameEn: "Tiered", nameAr: "Tiered",
      prices: listSource.prices, inventory: [{ inStock: true, availableQty: 50 }], variants: [],
    };
    const selection = resolveStorefrontSelection(product, undefined, 1, "AED")!;
    // The page's own test: more than one band in the resolved currency.
    const priceTiered = product.prices.filter((price) => price.currency === selection.currency).length > 1;
    const line = toWishlistCartLine({ ...toStorefrontWishlistItem(product, "tiered", selection, 1), priceTiered });
    expect(line).toMatchObject({ unitPrice: 100, priceTiered: true });
    expect(cartLineNeedsRepricing(line)).toBe(true);
  });

  it("counts only bands in the card currency and channel, so a single-band product is not flagged", () => {
    const single = {
      ...listSource,
      prices: [
        { type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 100, vatRate: 5 },
        // A second band in another currency, and a B2B band, do not tier the AED B2C price.
        { type: "B2C", currency: "SAR", minQty: 1, maxQty: null, price: 100, vatRate: 15 },
        { type: "B2B", currency: "AED", minQty: 10, maxQty: null, price: 70, vatRate: 5 },
      ],
    };
    const dto = toCatalogListDto(single, "B2C", "AED");
    expect(dto.priceTiered).toBe(false);
    expect(cartLineNeedsRepricing(cardLineFrom(dto))).toBe(false);
    expect(cartLineNeedsRepricing(toWishlistCartLine(cardWishlistFrom(dto)))).toBe(false);
  });

  it("flags a variant product when any variant, with its base-price fallback, has more than one band", () => {
    const dto = toCatalogListDto({
      ...listSource,
      prices: [{ type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 100, vatRate: 5 }],
      inventory: [{ variantId: "v", qty: 50, reservedQty: 0 }],
      variants: [{ id: "v", prices: [{ type: "B2C", currency: "AED", minQty: 10, maxQty: null, price: 80, vatRate: 5 }] }],
    }, "B2C", "AED");
    expect(dto.priceTiered).toBe(true);
  });

  it("refuses an in-place quantity change on a tiered line at the store, not only in the stepper", () => {
    const dto = toCatalogListDto(listSource, "B2C", "AED");
    const store = useCartStore.getState();
    store.clearCart();
    store.addItem(cardLineFrom(dto));
    store.addItem(cardLineFrom({ ...dto, id: "flat", slug: "flat", priceTiered: false }));
    const [tiered, flat] = useCartStore.getState().items;
    expect(tiered!.qty).toBe(1);
    expect(flat!.qty).toBe(1);

    // The tiered line keeps its quantity: 10 units would qualify for the 80
    // band, and setQty has no catalog to re-resolve the price from. The flat
    // line, whose price does not depend on quantity, changes as before.
    store.setQty(tiered!.id, 10);
    store.setQty(flat!.id, 10);
    const after = useCartStore.getState().items;
    expect(after.find((i) => i.id === tiered!.id)).toMatchObject({ qty: 1, unitPrice: 100 });
    expect(after.find((i) => i.id === flat!.id)).toMatchObject({ qty: 10 });
    expect(cartQuantityChangeHref(tiered!, 10)).toBe("/products/tiered?currency=AED&qty=10");
    store.clearCart();
  });
});

describe("storefront currency default", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads NEXT_PUBLIC_DEFAULT_CURRENCY when it names a storefront currency", () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_CURRENCY", "sar");
    expect(defaultStorefrontCurrency()).toBe("SAR");
  });

  it("treats an unset or unknown value as the launch market", () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_CURRENCY", "");
    expect(defaultStorefrontCurrency()).toBe("AED");
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_CURRENCY", "XYZ");
    expect(defaultStorefrontCurrency()).toBe("AED");
  });

  it("is the currency the list card prefers when the request names none", () => {
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_CURRENCY", "SAR");
    const dto = toCatalogListDto({
      id: "p", sellerId: "s", sku: "P", slug: "p", nameEn: "P", nameAr: "P",
      descriptionEn: null, descriptionAr: null, origin: null, tags: [], moq: 1,
      isPubliclyDiscoverable: true, isB2CEnabled: true, isB2BEnabled: false, images: [],
      prices: [
        { type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 100, vatRate: 5 },
        { type: "B2C", currency: "SAR", minQty: 1, maxQty: null, price: 90, vatRate: 15 },
      ],
      inventory: [{ variantId: null, qty: 5, reservedQty: 0 }], variants: [],
      category: { nameEn: "C", nameAr: "C", slug: "c" }, brand: null,
      seller: { businessNameEn: "S", businessNameAr: null, tier: "VERIFIED", rating: 0 },
    }, "B2C");
    expect(dto.cardPrice).toMatchObject({ currency: "SAR", amount: 90 });
  });
});
