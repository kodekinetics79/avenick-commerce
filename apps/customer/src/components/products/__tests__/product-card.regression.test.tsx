// @vitest-environment jsdom

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProductCard } from "../product-card";

const push = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    `${key}${values ? `:${JSON.stringify(values)}` : ""}`,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => push.mockClear());
afterEach(cleanup);

/** A tile shaped like the live catalogue: no inventory record, no price in this channel. */
const quoteOnly = {
  id: "p1",
  slug: "receptacle-16a",
  nameEn: "Industrial receptacle 16 A",
  nameAr: "مقبس صناعي 16 أمبير",
  sku: "PILOT-MENNEKES-130-0030420",
  sellerId: "seller-1",
  priceTiered: false,
  inStock: false,
  availabilityStatus: "UNCONFIRMED" as const,
  category: "Wiring devices & receptacles",
  locale: "en" as const,
};

/**
 * The tile a buyer actually meets.
 *
 * THE DEFECT. Every tile on the live storefront printed "Price on request",
 * then "Availability unconfirmed", then a button reading "Request
 * availability". The catalogue holds no inventory rows and no consumer prices,
 * so the list DTO marks every product UNCONFIRMED with `inStock: false` — and
 * the purchase rule put stock ahead of price for anything not in stock, whether
 * the stock was recorded as zero or never recorded at all. The buyer was asked
 * about the one thing that was not their question.
 */
describe("ProductCard on a quote-only catalogue", () => {
  it("asks for a quote when neither price nor stock is known", () => {
    render(<ProductCard {...quoteOnly} />);
    const button = screen.getByRole("button", { name: /requestQuote/ });
    expect(screen.queryByRole("button", { name: /requestAvailability/ })).toBeNull();

    fireEvent.click(button);
    // The RFQ contract is unchanged: only the words moved.
    expect(push).toHaveBeenCalledWith("/b2b/rfq/new?supplier=seller-1&product=p1");
  });

  it("keeps asking about availability for a priced product whose stock is unknown, and never carts it", () => {
    render(<ProductCard {...quoteOnly} price={120} currency="AED" vatRate={5} />);
    expect(screen.getByRole("button", { name: /requestAvailability/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /addToCart/ })).toBeNull();
  });

  /**
   * THE RECORD. The category and the SKU shared one row, the SKU could not
   * shrink, and the catalogue's SKUs run to thirty monospace characters — so
   * the category measured 0px on every phone tile and the SKU ran past the
   * tile's clipped edge. Layout is not measurable here; what is, is the rule the
   * fix rests on: the purchase-order identifier is printed whole and nothing
   * on its way up to the card is allowed to cut it with an ellipsis or a clamp.
   */
  it("prints the whole SKU and never truncates it", () => {
    const { container } = render(<ProductCard {...quoteOnly} />);
    const sku = [...container.querySelectorAll("span")].find((el) =>
      [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent === quoteOnly.sku),
    );
    expect(sku, "the SKU is not printed whole").toBeTruthy();

    for (let el: HTMLElement | null = sku!; el && el !== container; el = el.parentElement) {
      expect(el.className, `an ancestor of the SKU cuts it: <${el.tagName.toLowerCase()} class="${el.className}">`).not.toMatch(
        /(^|\s)(truncate|text-ellipsis|line-clamp-\d)(\s|$)/,
      );
    }
    expect(screen.getByText(quoteOnly.category)).toBeTruthy();
  });

  it("leaves the eyebrow out, not blank, when there is nothing to file it under", () => {
    const { container } = render(<ProductCard {...quoteOnly} category={undefined} />);
    expect(container.querySelector(".u-micro")).toBeNull();
  });
});
