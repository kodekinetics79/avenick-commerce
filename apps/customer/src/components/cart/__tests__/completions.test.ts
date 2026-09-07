import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { useCartStore } from "@/stores/cart";
import { cartLineKey, useCartDrawerStore } from "../cart-drawer-store";
import {
  cartLineFromCompletion,
  completionAction,
  completionsNotInCart,
  ladderTiersFrom,
  type CartCompletionRow,
} from "../completions";

const source = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

const row = (over: Partial<CartCompletionRow> = {}): CartCompletionRow => ({
  id: "p1",
  slug: "busbar-400a",
  nameEn: "Busbar 400 A",
  nameAr: "قضيب توزيع ٤٠٠ أمبير",
  sku: "BB-400",
  sellerId: "seller-1",
  price: 120,
  currency: "AED",
  vatRate: 5,
  inStock: true,
  hasVariants: false,
  priceTiered: false,
  moq: 10,
  rating: null,
  ...over,
});

describe("cart completions", () => {
  it("drops rows already in the cart and never shows a product twice", () => {
    const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "a" }), row({ id: "c" })];
    const visible = completionsNotInCart(rows, [{ productId: "b" }]);
    expect(visible.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("is absent, not padded, when nothing is left to suggest", () => {
    expect(completionsNotInCart([row({ id: "a" })], [{ productId: "a" }])).toEqual([]);
    expect(completionsNotInCart([], [])).toEqual([]);
  });

  it("routes each row the way the product card would", () => {
    // Out of stock: availability is requested, never carted.
    expect(completionAction(row({ inStock: false }), "B2C")).toEqual({
      kind: "REQUEST_AVAILABILITY",
      href: "/b2b/rfq/new?supplier=seller-1&product=p1",
    });
    // Variants: the product page makes the selection, and the link keeps the channel.
    expect(completionAction(row({ hasVariants: true }), "B2B")).toEqual({
      kind: "SELECT_VARIANT",
      href: "/products/busbar-400a?currency=AED&b2b=true",
    });
    // No price in this channel: the quote path goes to RFQ, not into the drawer.
    expect(completionAction(row({ price: undefined, currency: undefined, vatRate: undefined }), "B2B")).toEqual({
      kind: "REQUEST_QUOTE",
      href: "/b2b/rfq/new?supplier=seller-1&product=p1",
    });
    expect(completionAction(row(), "B2C")).toEqual({ kind: "ADD_TO_CART" });
  });

  it("builds the same line the product card writes, opening at MOQ", () => {
    const line = cartLineFromCompletion(row({ priceTiered: true }), "B2B");
    expect(line).toEqual({
      productId: "p1",
      slug: "busbar-400a",
      channel: "B2B",
      nameEn: "Busbar 400 A",
      nameAr: "قضيب توزيع ٤٠٠ أمبير",
      imageUrl: undefined,
      sku: "BB-400",
      qty: 10,
      moq: 10,
      unitPrice: 120,
      vatRate: 5,
      priceTiered: true,
      sellerId: "seller-1",
      currency: "AED",
    });
    expect(cartLineFromCompletion(row({ moq: undefined }), "B2C")).toMatchObject({ qty: 1, moq: 1 });
    expect(cartLineFromCompletion(row({ price: undefined }), "B2C")).toBeNull();
  });

  it("finds the line the cart store just keyed, so the drawer features what was added", () => {
    const store = useCartStore.getState();
    store.clearCart();
    store.addItem(cartLineFromCompletion(row(), "B2C")!);
    store.addItem({ ...cartLineFromCompletion(row({ id: "p2" }), "B2C")!, variantId: "v9" });
    const [plain, variant] = useCartStore.getState().items;
    expect(plain!.id).toBe(cartLineKey("p1"));
    expect(variant!.id).toBe(cartLineKey("p2", "v9"));
  });

  it("opens only through openFor, keeps the featured line across a close, and is never persisted", () => {
    const drawer = useCartDrawerStore.getState();
    expect(drawer.open).toBe(false);
    drawer.openFor({ productId: "p1", priceBands: [{ minQty: 1, maxQty: 9, amount: 120 }] });
    expect(useCartDrawerStore.getState()).toMatchObject({ open: true, lastAddedKey: "p1-", lastAddedBands: null });
    drawer.openFor({
      productId: "p2",
      variantId: "v9",
      priceBands: [
        { minQty: 1, maxQty: 9, amount: 120 },
        { minQty: 10, maxQty: null, amount: 100 },
      ],
    });
    expect(useCartDrawerStore.getState().lastAddedBands).toHaveLength(2);
    drawer.setOpen(false);
    expect(useCartDrawerStore.getState()).toMatchObject({ open: false, lastAddedKey: "p2-v9" });
    // The cart store is wrapped in zustand's persist middleware; the drawer
    // store must never be, or the open flag would come back on the next page
    // load and the drawer would open itself. Pinned at the source: the
    // middleware module is not imported there at all.
    expect(source("../../../stores/cart.ts")).toContain("zustand/middleware");
    expect(source("../cart-drawer-store.ts")).not.toContain("zustand/middleware");
  });

  it("formats the ladder with the card's left-to-right marks and drops a single band", () => {
    const tiers = ladderTiersFrom(
      [
        { minQty: 50, maxQty: null, amount: 90 },
        { minQty: 1, maxQty: 49, amount: 120 },
      ],
      "AED",
      "en",
    );
    expect(tiers.map((tier) => tier.band)).toEqual(["‎1–49", "‎50+"]);
    expect(tiers[0]!.price).toContain("120");
    expect(ladderTiersFrom([{ minQty: 1, maxQty: null, amount: 120 }], "AED", "en")).toEqual([]);
    expect(ladderTiersFrom(null, "AED", "en")).toEqual([]);
  });
});
