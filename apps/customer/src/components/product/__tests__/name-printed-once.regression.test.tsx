// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { bilingualName } from "../product-facts";
import { ProductGallery } from "../product-gallery";
import { SellerCard } from "../seller-card";

/**
 * A product page prints each name once, and each fact once per screen.
 *
 * THE DEFECT. The bilingual secondary line under the product title and under
 * the seller's name was printed whenever the other language's column was
 * non-empty. All 385 live products, and five of nine seller profiles, store the
 * English name in the Arabic column too, so every product page printed its h1
 * twice — the second copy set right-to-left and pushed to the inline end, where
 * it read as a misaligned layout — and "Pilot Catalog — 3M" twice on the card.
 * On a phone "Availability unconfirmed" also appeared twice in the first screen
 * and a quarter: under the photograph and again under the title.
 *
 * What these hold: an identical string is never carried as its own translation;
 * a real translation still is, in both directions; and the gallery's copy of the
 * availability dot stands down below lg, where the title's copy is a scroll away.
 */

afterEach(cleanup);

describe("bilingualName", () => {
  it("carries a real translation beneath the reader's own language", () => {
    expect(bilingualName("Busbar 400 A", "قضيب توزيع 400 أمبير", "en")).toEqual({ primary: "Busbar 400 A", secondary: "قضيب توزيع 400 أمبير" });
    expect(bilingualName("Busbar 400 A", "قضيب توزيع 400 أمبير", "ar")).toEqual({ primary: "قضيب توزيع 400 أمبير", secondary: "Busbar 400 A" });
  });

  it("does not print an echo as a translation", () => {
    expect(bilingualName("Wire & Cable Lubricants", "Wire & Cable Lubricants", "en").secondary).toBe("");
    expect(bilingualName("Wire & Cable Lubricants", "Wire & Cable Lubricants ", "ar").secondary).toBe("");
  });

  it("leads with English in Arabic when no Arabic name exists, with nothing beneath", () => {
    expect(bilingualName("Busbar 400 A", "", "ar")).toEqual({ primary: "Busbar 400 A", secondary: "" });
    expect(bilingualName("Busbar 400 A", "  ", "ar")).toEqual({ primary: "Busbar 400 A", secondary: "" });
  });
});

describe("SellerCard name", () => {
  const labels = {
    eyebrow: "Sold by",
    requestQuote: "Request a quote",
    location: (city: string, country: string) => `${city}, ${country}`,
    ratingBasis: (count: number) => `${count}`,
    tier: () => null,
    verifiedBasis: () => null,
  };

  it("prints a trading name stored in both columns once", () => {
    render(
      <SellerCard
        seller={{ businessNameEn: "Pilot Catalog — 3M", businessNameAr: "Pilot Catalog — 3M", city: "Riyadh", country: "SA" }}
        locale="en"
        labels={labels}
      />,
    );
    expect(screen.getAllByText("Pilot Catalog — 3M")).toHaveLength(1);
  });
});

describe("ProductGallery availability dot", () => {
  it("stands down below lg, where the title's own dot is a scroll away", () => {
    render(
      <ProductGallery
        images={[{ url: "https://images.test/a.png" }]}
        productName="Busbar 400 A"
        sku="BB-400"
        availability="UNCONFIRMED"
        availabilityLabel="Availability unconfirmed"
        locale="en"
      />,
    );
    const dot = screen.getByText("Availability unconfirmed");
    expect(dot.className).toContain("max-lg:hidden");
    // A lone image leaves the row nothing else, so the row stands down with it.
    expect(dot.parentElement?.className).toContain("max-lg:hidden");
  });

  it("keeps the row for the position readout when there is more than one image", () => {
    render(
      <ProductGallery
        images={[{ url: "https://images.test/a.png" }, { url: "https://images.test/b.png" }]}
        productName="Busbar 400 A"
        sku="BB-400"
        availability="UNCONFIRMED"
        availabilityLabel="Availability unconfirmed"
        locale="en"
      />,
    );
    expect(screen.getByText("Availability unconfirmed").parentElement?.className).not.toContain("max-lg:hidden");
  });
});
