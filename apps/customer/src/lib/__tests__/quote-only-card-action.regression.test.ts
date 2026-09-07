import { describe, expect, it } from "vitest";
import { productCardPurchaseAction } from "../product-card-commerce";
import { completionAction } from "@/components/cart/completions";

/**
 * A quote-only product has a control that works.
 *
 * THE DEFECT. `productCardPurchaseAction` decided from stock and variants and
 * never from price, so a product this storefront cannot price — most of the
 * catalogue, which is quoted rather than carted — resolved to ADD_TO_CART. The
 * tile printed "Price on request" above a cart button it then had to disable,
 * and the buyer's only control on the tile was permanently dead. The RFQ route
 * that would have worked was one branch away, reachable only when the product
 * was also out of stock.
 *
 * THE SECOND HALF. The cart drawer's `completionAction` applied its own price
 * check afterwards and got the right answer, while its comment claimed to make
 * "the SAME decision the product card makes, in the same order". Two
 * implementations of one rule, one of them wrong, with a comment asserting they
 * agreed. The check now lives in the shared function and both callers pass
 * through it — which is what these tests hold in place.
 */
describe("quote-only products have a live control", () => {
  it("routes an unpriced, in-stock, variant-free product to a quote", () => {
    expect(productCardPurchaseAction(false, true, false)).toBe("REQUEST_QUOTE");
  });

  it("still carts a product that can actually be priced", () => {
    expect(productCardPurchaseAction(false, true, true)).toBe("ADD_TO_CART");
  });

  it("keeps stock ahead of price: out of stock asks about availability, not price", () => {
    // The buyer's question differs, so the label must, so the action must.
    expect(productCardPurchaseAction(false, false, false)).toBe("REQUEST_AVAILABILITY");
    expect(productCardPurchaseAction(false, false, true)).toBe("REQUEST_AVAILABILITY");
  });

  it("keeps variants ahead of price: a variant row navigates rather than quoting", () => {
    // The base row has no authoritative price BECAUSE a variant carries it.
    // Quoting from here would ask about a product the buyer has not chosen yet.
    expect(productCardPurchaseAction(true, true, false)).toBe("SELECT_VARIANT");
  });

  it("defaults to priced, so the two-argument callers are unchanged", () => {
    expect(productCardPurchaseAction(true)).toBe("SELECT_VARIANT");
    expect(productCardPurchaseAction(false)).toBe("ADD_TO_CART");
    expect(productCardPurchaseAction(false, false)).toBe("REQUEST_AVAILABILITY");
  });

  /**
   * The agreement itself. If either caller grows a second price rule, one of
   * these rows starts disagreeing with the tile and this fails.
   */
  it("the drawer and the tile reach the same verdict on the same product", () => {
    const row = {
      id: "p1",
      slug: "p1",
      sellerId: "s1",
      hasVariants: false,
      inStock: true,
      moq: 1,
      currency: "SAR",
      vatRate: 15,
    };

    const quoted = { ...row, price: null };
    expect(completionAction(quoted as never, "B2B").kind).toBe("REQUEST_QUOTE");
    expect(productCardPurchaseAction(quoted.hasVariants, quoted.inStock, false)).toBe("REQUEST_QUOTE");

    const priced = { ...row, price: 100 };
    expect(completionAction(priced as never, "B2B").kind).toBe("ADD_TO_CART");
    expect(productCardPurchaseAction(priced.hasVariants, priced.inStock, true)).toBe("ADD_TO_CART");
  });

  /**
   * A price with no currency or no VAT rate cannot become a cart line — the cart
   * would carry a figure it could not total. That is a quote, not a cart line,
   * and not a disabled button.
   */
  it("treats an incomplete price as unpriceable rather than as a dead control", () => {
    const base = { id: "p", slug: "p", sellerId: "s", hasVariants: false, inStock: true, moq: 1, price: 100 };
    expect(completionAction({ ...base, currency: undefined, vatRate: 15 } as never, "B2B").kind).toBe("REQUEST_QUOTE");
    expect(completionAction({ ...base, currency: "SAR", vatRate: null } as never, "B2B").kind).toBe("REQUEST_QUOTE");
  });
});
