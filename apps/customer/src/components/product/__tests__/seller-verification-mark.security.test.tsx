// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SellerCard, type ProductSeller } from "../seller-card";

/**
 * A "Verified" mark on a supplier card cites a reviewed document, or it does
 * not render.
 *
 * THE DEFECT. Every product page's "Sold by" card printed a brass VERIFIED pill.
 * Production held four sellers with active listings, all tier VERIFIED, and zero
 * SellerDocument rows with status APPROVED between them: the tier was a constant
 * the pilot importer wrote (pilot-catalog.ts), not the outcome of a review. The
 * card's own docblock called a Verified badge with no reviewed document behind
 * it "a fabricated trust signal", withheld the brass SEAL for exactly that
 * reason — and still printed the word, in brass, from the stored tier. LAW F;
 * SIJILL §10.5 (the seal without its basis).
 *
 * What these hold: VERIFIED with no citation renders no tier mark of any kind —
 * not the pill, not a neutral "Verified"; with a citation it renders the seal
 * with the document and date as its accessible name and a printed provenance
 * line, and no second brass pill; a citation the page cannot word renders
 * nothing; and tiers that assert no review are unchanged.
 */

afterEach(cleanup);

const TIER: Record<string, string> = { STANDARD: "Standard", VERIFIED: "Verified", GOLD: "Gold", PLATINUM: "Platinum" };

const labels = {
  eyebrow: "Sold by",
  requestQuote: "Request a quote",
  location: (city: string, country: string) => `${city}, ${country}`,
  ratingBasis: (count: number) => `${count} reviews`,
  tier: (tier: string) => TIER[tier] ?? null,
  verifiedBasis: (type: string, reviewedAt: string | Date) =>
    type === "TRADE_LICENSE" ? `Trade licence reviewed ${new Date(reviewedAt).toISOString().slice(0, 10)}` : null,
};

const seller = (overrides: Partial<ProductSeller> = {}): ProductSeller => ({
  id: "s1",
  businessNameEn: "Pilot Catalog — 3M",
  businessNameAr: null,
  tier: "VERIFIED",
  city: "Riyadh",
  country: "SA",
  reviewSummary: { averageRating: null, reviewCount: 0 },
  ...overrides,
});

describe("SellerCard verification mark", () => {
  it("renders no tier mark at all for a stored VERIFIED tier with no approved document", () => {
    render(<SellerCard seller={seller({ verification: null })} locale="en" labels={labels} />);
    expect(screen.queryByText("Verified")).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("treats a missing verification field the same as none", () => {
    render(<SellerCard seller={seller()} locale="en" labels={labels} />);
    expect(screen.queryByText("Verified")).toBeNull();
  });

  it("renders the seal with its citation when an approved document stands, and no second pill", () => {
    render(
      <SellerCard
        seller={seller({ verification: { type: "TRADE_LICENSE", reviewedAt: "2026-02-14T09:00:00.000Z" } })}
        locale="en"
        labels={labels}
      />,
    );
    const seal = screen.getByRole("note");
    expect(seal.getAttribute("aria-label")).toBe("Verified — Trade licence reviewed 2026-02-14");
    // One visible "Verified": the seal's own. The brass tier pill is not added beside it.
    expect(screen.getAllByText("Verified")).toHaveLength(1);
    expect(screen.getByText("Trade licence reviewed 2026-02-14")).toBeTruthy();
  });

  it("renders nothing when the citation cannot be worded, rather than a mark without one", () => {
    render(
      <SellerCard
        seller={seller({ verification: { type: "SOMETHING_NEW", reviewedAt: "2026-02-14T09:00:00.000Z" } })}
        locale="en"
        labels={labels}
      />,
    );
    expect(screen.queryByText("Verified")).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("never lets a document stand in for a tier that is not VERIFIED", () => {
    render(
      <SellerCard
        seller={seller({ tier: "STANDARD", verification: { type: "TRADE_LICENSE", reviewedAt: "2026-02-14T09:00:00.000Z" } })}
        locale="en"
        labels={labels}
      />,
    );
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByText("Standard")).toBeTruthy();
  });

  it("leaves tiers that assert no review unchanged", () => {
    render(<SellerCard seller={seller({ tier: "GOLD" })} locale="en" labels={labels} />);
    expect(screen.getByText("Gold")).toBeTruthy();
  });
});
