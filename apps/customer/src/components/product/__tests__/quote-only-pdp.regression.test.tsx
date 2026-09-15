// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    `${namespace}.${key}${values ? `:${JSON.stringify(values)}` : ""}`,
}));

import { productCardPurchaseAction } from "@/lib/product-card-commerce";
import { BuyActions } from "../buy-actions";
import { PricePanel } from "../price-panel";
import { quoteOnlyAction } from "../product-facts";

/**
 * A quote-only product page is a path to a quote, not an error.
 *
 * THE DEFECT. 383 of the 385 live listings publish business price bands only,
 * and the anonymous detail DTO filters prices by channel, so almost every
 * visitor reached the product page with no resolvable selection. The page read
 * that as one state and rendered it as a failure: danger-ink "No applicable
 * price is available for this selection and quantity", a basis line claiming
 * none of the published bands covered the combination (they do, in the other
 * channel), a quantity well locked at the MOQ, a disabled Add to cart, a
 * disabled wishlist heart — and, on a phone, a fixed bar holding only the red
 * sentence and the dead button at every scroll position. The request that
 * actually works sat underneath as a secondary button. The tiles on the same
 * page had already been taught "a product this storefront cannot price is a
 * product to quote".
 *
 * These tests hold three things: the page separates "no price in this view"
 * from "no band covers this selection"; the quote state reads as a calm
 * designed state with one primary action; and the action's label is the
 * tile's own decision rather than a second rule that could disagree with it.
 */

afterEach(cleanup);

const noPrices = {
  prices: [],
  variants: [],
  inventory: [{ inStock: false, availableQty: 0, status: "UNCONFIRMED" as const }],
};

const band = { type: "B2C", currency: "AED", minQty: 10, maxQty: null, price: 12, vatRate: 5 };

describe("quoteOnlyAction separates a quote-only product from a band gap", () => {
  it("names a quote-only product when no price row reached this view", () => {
    // No price and no stock record ("UNCONFIRMED"): the tile's rule asks for a
    // quote, so this page does too (lib/__tests__/quote-only-card-action).
    expect(quoteOnlyAction(noPrices, undefined, false)).toBe("REQUEST_QUOTE");
    expect(quoteOnlyAction({ ...noPrices, inventory: [{ inStock: true, availableQty: 5 }] }, undefined, false))
      .toBe("REQUEST_QUOTE");
  });

  it("is null whenever a selection resolved", () => {
    expect(quoteOnlyAction(noPrices, undefined, true)).toBeNull();
  });

  it("still asks about availability, as the tile does, when stock is RECORDED as zero", () => {
    // Out of stock is a question about stock, priced or not. Before this page
    // passed the availability status, it could not tell this case from the
    // unconfirmed one above and gave both the same label.
    const outOfStock = { ...noPrices, inventory: [{ inStock: false, availableQty: 0, status: "OUT_OF_STOCK" as const }] };
    expect(quoteOnlyAction(outOfStock, undefined, false)).toBe("REQUEST_AVAILABILITY");
  });

  it("is null when prices exist but none covers the selection — that gap keeps its own copy", () => {
    expect(quoteOnlyAction({ ...noPrices, prices: [band] }, undefined, false)).toBeNull();
    const variantPriced = {
      ...noPrices,
      variants: [{ id: "v1", sku: "V1", nameEn: "V1", nameAr: null, attributes: {}, prices: [band], inStock: true, availableQty: 1 }],
    };
    expect(quoteOnlyAction(variantPriced, "v1", false)).toBeNull();
  });

  it("reads the SELECTED variant's stock, because the choice is already made on this page", () => {
    const variants = [
      { id: "v1", sku: "V1", nameEn: "V1", nameAr: null, attributes: {}, prices: [], inStock: false, availableQty: 0 },
      { id: "v2", sku: "V2", nameEn: "V2", nameAr: null, attributes: {}, prices: [], inStock: true, availableQty: 9 },
    ];
    expect(quoteOnlyAction({ ...noPrices, variants }, "v1", false)).toBe("REQUEST_AVAILABILITY");
    expect(quoteOnlyAction({ ...noPrices, variants }, "v2", false)).toBe("REQUEST_QUOTE");
  });

  it("agrees with the tile on the same stock fact, so the page never relabels the button the buyer pressed", () => {
    for (const inStock of [true, false]) {
      const tile = productCardPurchaseAction(false, inStock, false);
      const page = quoteOnlyAction({ ...noPrices, inventory: [{ inStock, availableQty: inStock ? 1 : 0 }] }, undefined, false);
      expect(page).toBe(tile);
    }
  });
});

const panelProps = {
  selection: null,
  currency: "AED" as const,
  locale: "en" as const,
  qty: 72,
  moq: 72,
  isB2B: false,
  ladder: [],
  onSetQty: () => {},
};

describe("PricePanel", () => {
  it("sets a quote-only product as 'Price on request' in ordinary ink, with a basis this view can prove", () => {
    render(<PricePanel {...panelProps} quoteOnly />);
    const headline = screen.getByText("catalogue.quoteOnRequest");
    expect(headline.className).not.toContain("danger");
    expect(screen.getByText('pdp.price.onRequestBasis:{"channel":"B2C"}')).toBeTruthy();
    expect(screen.queryByText("pdp.price.none")).toBeNull();
    expect(screen.queryByText("pdp.price.noneBasis")).toBeNull();
  });

  it("names the channel and the requested currency, and nothing it cannot see", () => {
    render(<PricePanel {...panelProps} isB2B quoteOnly requestedCurrency="SAR" />);
    expect(screen.getByText('pdp.price.onRequestBasisCurrency:{"channel":"B2B","currency":"SAR"}')).toBeTruthy();
  });

  it("keeps the genuine gap — published bands, none covering the selection — as a stated mismatch", () => {
    render(<PricePanel {...panelProps} />);
    expect(screen.getByText("pdp.price.none").className).toContain("text-danger-ink");
    expect(screen.queryByText("catalogue.quoteOnRequest")).toBeNull();
  });
});

const buyProps = {
  qty: 72,
  moq: 72,
  maxQty: 0,
  canBuy: false,
  inStock: false,
  added: null,
  addedToken: 0,
  onQty: () => {},
  onAdd: () => {},
  requestAvailabilityHref: "/b2b/rfq/new?supplier=s1&product=p1",
};

describe("BuyActions in the quote-only state", () => {
  it("offers ONE live primary request and no disabled stepper or cart button", () => {
    render(<BuyActions {...buyProps} request={{ href: "/b2b/rfq/new?supplier=s1&product=p1", action: "REQUEST_QUOTE" }} />);
    const link = screen.getByRole("link", { name: /pdp\.seller\.requestQuote/ });
    expect(link.getAttribute("href")).toBe("/b2b/rfq/new?supplier=s1&product=p1");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText("pdp.buy.addToCart")).toBeNull();
    // The MOQ survives as a fact, without the stepper's "cannot go below it".
    expect(screen.getByText('pdp.ladder.moq:{"qty":72}')).toBeTruthy();
    expect(screen.queryByText(/pdp\.buy\.moqNote/)).toBeNull();
  });

  it("labels an availability request as one, exactly as the tile does", () => {
    render(<BuyActions {...buyProps} request={{ href: "/b2b/rfq/new?supplier=s1&product=p1", action: "REQUEST_AVAILABILITY" }} />);
    expect(screen.getByRole("link", { name: /pdp\.buy\.requestAvailability/ })).toBeTruthy();
  });

  it("leaves a priced line's commit controls exactly as they were", () => {
    render(<BuyActions {...buyProps} canBuy inStock maxQty={500} />);
    expect(screen.getByText("pdp.buy.addToCart")).toBeTruthy();
    expect(screen.getByRole("button", { name: "pdp.buy.increase" })).toBeTruthy();
  });
});
