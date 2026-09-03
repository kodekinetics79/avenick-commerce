import { describe, expect, it } from "vitest";
import { homeCategoryLinks, partitionHomeProducts } from "./home-catalog";

describe("live homepage catalog navigation", () => {
  it("builds category routes from the API slugs instead of obsolete static slugs", () => {
    expect(homeCategoryLinks([
      { id: "c1", slug: "industrial-connectors", nameEn: "Industrial Connectors", nameAr: "موصلات صناعية" },
      { id: "c2", slug: "circuit-breakers", nameEn: "Circuit Breakers", nameAr: null },
    ], "ar")).toEqual([
      { id: "c1", slug: "industrial-connectors", label: "موصلات صناعية", href: "/products?category=industrial-connectors" },
      { id: "c2", slug: "circuit-breakers", label: "Circuit Breakers", href: "/products?category=circuit-breakers" },
    ]);
  });

  it("does not repeat the same products in both homepage collections", () => {
    const products = Array.from({ length: 10 }, (_, index) => ({ id: `p${index + 1}` }));
    const sections = partitionHomeProducts(products);
    expect(sections.catalog.map(({ id }) => id)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(sections.more.map(({ id }) => id)).toEqual(["p6", "p7", "p8", "p9", "p10"]);
    expect(sections.more.some(({ id }) => sections.catalog.some((product) => product.id === id))).toBe(false);
  });
});
