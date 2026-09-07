import { describe, expect, it } from "vitest";
import { HERO_SLIDE_LIMIT, toHeroSlides, type HeroSlideSource } from "../hero-slides";

function row(over: Partial<HeroSlideSource> & { id: string }): HeroSlideSource {
  return {
    slug: `product-${over.id}`,
    nameEn: `Product ${over.id}`,
    nameAr: `منتج ${over.id}`,
    imageUrl: `https://cdn.example.test/${over.id}.png`,
    category: "Electrical",
    price: 12.5,
    currency: "AED",
    priceIsFrom: false,
    hasVariants: false,
    ...over,
  };
}

describe("toHeroSlides", () => {
  it("keeps one slide per product NAME, in feed order", () => {
    // The pilot feed: three lubricants and two connectors at the top.
    const rows = [
      row({ id: "1", nameEn: "Wire & Cable Lubricant" }),
      row({ id: "2", nameEn: "Wire & Cable Lubricant" }),
      row({ id: "3", nameEn: "Wire & Cable Lubricant" }),
      row({ id: "4", nameEn: "Twist-on Wire Connector" }),
      row({ id: "5", nameEn: "Twist-on Wire Connector" }),
      row({ id: "6", nameEn: "Cable Tie" }),
    ];
    expect(toHeroSlides(rows, { locale: "en" }).map((s) => s.id)).toEqual(["1", "4", "6"]);
  });

  it("prefers pictured products and falls back to the lead row alone when nothing is pictured", () => {
    const mixed = [row({ id: "1", imageUrl: null }), row({ id: "2" }), row({ id: "3", imageUrl: undefined })];
    expect(toHeroSlides(mixed, { locale: "en" }).map((s) => s.id)).toEqual(["2"]);

    const none = [row({ id: "1", imageUrl: null }), row({ id: "2", imageUrl: null })];
    const slides = toHeroSlides(none, { locale: "en" });
    expect(slides.map((s) => s.id)).toEqual(["1"]);
    expect(slides[0]!.imageUrl).toBeNull();
  });

  it("never exceeds the limit, and an empty feed is an empty carousel", () => {
    const many = Array.from({ length: 14 }, (_, i) => row({ id: String(i + 1) }));
    expect(toHeroSlides(many, { locale: "en" })).toHaveLength(HERO_SLIDE_LIMIT);
    expect(toHeroSlides(many, { locale: "en", limit: 3 })).toHaveLength(3);
    expect(toHeroSlides([], { locale: "en" })).toEqual([]);
  });

  it("carries the product's own figure and qualifies a banded price beside it, never baked in", () => {
    const [exact, banded, flagged, unpriced, unsupported] = toHeroSlides(
      [
        row({ id: "1" }),
        row({ id: "2", hasVariants: true }),
        row({ id: "3", priceIsFrom: true }),
        row({ id: "4", price: null }),
        row({ id: "5", currency: "XYZ" }),
      ],
      { locale: "en" },
    );
    expect(exact!.amount).toEqual(expect.stringContaining("12.50"));
    expect(exact!.amount).not.toMatch(/from/i);
    expect(exact!.isFrom).toBe(false);
    expect(banded!.isFrom).toBe(true);
    expect(banded!.amount).not.toMatch(/from/i);
    expect(flagged!.isFrom).toBe(true);
    // LAW F: no public price means no figure — not a borrowed one.
    expect(unpriced!.amount).toBeNull();
    expect(unpriced!.isFrom).toBe(false);
    expect(unsupported!.amount).toBeNull();
  });

  it("names the product in the active locale and drops an unknown category rather than inventing one", () => {
    const rows = [row({ id: "1", category: undefined }), row({ id: "2", nameAr: null })];
    const ar = toHeroSlides(rows, { locale: "ar" });
    expect(ar[0]!.name).toBe("منتج 1");
    expect(ar[0]!.category).toBeNull();
    // An unset Arabic name falls back to English rather than to an empty caption.
    expect(ar[1]!.name).toBe("Product 2");
    expect(toHeroSlides(rows, { locale: "en" })[0]!.name).toBe("Product 1");
  });
});
