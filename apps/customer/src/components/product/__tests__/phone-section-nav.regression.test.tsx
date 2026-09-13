// @vitest-environment jsdom

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SectionNav } from "../section-nav";
import { SellerCard } from "../seller-card";

/**
 * On a phone the product page's controls can be found and pressed.
 *
 * THE DEFECTS. At 390px the sticky section nav showed "Description |
 * Specifications | Reviews (0)". "Shipping & returns" sat at x 370–525 inside a
 * 356px strip with a hidden scrollbar, no mask and no control (scrollWidth 508),
 * and it stayed hidden even while the reader was inside that section. The
 * supplier card's "Request a quote" was a 30px-tall target. And the section nav
 * printed, along with the rest of the screen chrome.
 *
 * What these hold: the strip wears the symmetric edge fade only when it really
 * overflows; when the active section changes, the STRIP scrolls to show its tab,
 * the document does not; the nav is not printed; and the supplier card's request
 * takes the large control height below sm.
 */

const SECTIONS = [
  { id: "description", label: "Description" },
  { id: "specs", label: "Specifications" },
  { id: "reviews", label: "Reviews (0)" },
  { id: "shipping", label: "Shipping & returns" },
];

// Where each tab sits inside a 356px strip whose content is 508px wide.
const TAB_X: Record<string, [number, number]> = {
  "#description": [0, 120],
  "#specs": [120, 250],
  "#reviews": [250, 370],
  "#shipping": [370, 508],
};

function layout(scrollWidth: number, clientWidth: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() { return this.tagName === "UL" ? scrollWidth : 0; },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() { return this.tagName === "UL" ? clientWidth : 0; },
  });
}

const rect = (left: number, right: number) =>
  ({ left, right, top: 0, bottom: 44, width: right - left, height: 44, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;

let scrollBy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollBy = vi.fn();
  (HTMLElement.prototype as unknown as { scrollBy: unknown }).scrollBy = scrollBy;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.tagName === "UL") return rect(0, 356);
    const [left, right] = TAB_X[this.getAttribute("href") ?? ""] ?? [0, 0];
    return rect(left, right);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollBy;
});

describe("SectionNav on a phone", () => {
  it("feathers both ends of the strip when the tabs do not fit", () => {
    layout(508, 356);
    render(<SectionNav label="Product sections" sections={SECTIONS} active="description" />);
    expect(screen.getByRole("list").className).toContain("u-edge-fade-inline");
  });

  it("does not feather a strip whose tabs all fit", () => {
    layout(508, 1100);
    render(<SectionNav label="Product sections" sections={SECTIONS} active="description" />);
    expect(screen.getByRole("list").className).not.toContain("u-edge-fade-inline");
  });

  it("scrolls the strip, and only the strip, to show the tab of the section being read", () => {
    layout(508, 356);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const intoView = vi.fn();
    (HTMLElement.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = intoView;
    const { rerender } = render(<SectionNav label="Product sections" sections={SECTIONS} active="description" />);
    scrollBy.mockClear();
    rerender(<SectionNav label="Product sections" sections={SECTIONS} active="shipping" />);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0]![0].left).toBeGreaterThanOrEqual(508 - 356);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(intoView).not.toHaveBeenCalled();
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView;
  });

  it("leaves a tab that is already in view where it is", () => {
    layout(508, 356);
    const { rerender } = render(<SectionNav label="Product sections" sections={SECTIONS} active="description" />);
    scrollBy.mockClear();
    rerender(<SectionNav label="Product sections" sections={SECTIONS} active="specs" />);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("is not printed", () => {
    layout(508, 356);
    render(<SectionNav label="Product sections" sections={SECTIONS} active="description" />);
    expect(screen.getByRole("navigation", { name: "Product sections" }).className).toContain("print:hidden");
  });
});

describe("SellerCard request on a phone", () => {
  it("takes the large control height below sm", () => {
    render(
      <SellerCard
        seller={{ businessNameEn: "Seller", city: "Riyadh", country: "SA" }}
        locale="en"
        quoteHref="/b2b/rfq/new?supplier=s1&product=p1"
        labels={{
          eyebrow: "Sold by",
          requestQuote: "Request a quote",
          location: (city, country) => `${city}, ${country}`,
          ratingBasis: (count) => String(count),
          tier: () => null,
          verifiedBasis: () => null,
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Request a quote/ }).className).toContain("max-sm:h-control-lg");
  });
});
