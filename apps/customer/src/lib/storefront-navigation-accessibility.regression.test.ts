import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("storefront navigation accessibility", () => {
  it("keeps card actions outside the product link and exposes persistent labeled controls", () => {
    const card = source("../components/products/product-card.tsx");
    const productLinkStart = card.indexOf("<Link href={productHref}");
    const productLinkEnd = card.indexOf("</Link>", productLinkStart);

    expect(productLinkStart).toBeGreaterThan(-1);
    expect(productLinkEnd).toBeGreaterThan(productLinkStart);
    expect(card.slice(productLinkStart, productLinkEnd)).not.toContain("<button");
    expect(card).toContain("aria-pressed={wishlisted}");
    expect(card).toContain("Add ${name} to wishlist");
    expect(card).toContain('className="flex h-10 w-full');
    expect(card).not.toContain("group-hover:opacity-100");
  });

  it("provides keyboard-operable account and mobile primary navigation", () => {
    const header = source("../components/layout/header.tsx");
    expect(header).toContain('<details className="group relative">');
    expect(header).toContain('aria-label="Account menu"');
    expect(header).toContain('aria-label="Mobile primary navigation"');
    expect(header).toContain('aria-label="Open primary navigation"');
    expect(header).toContain('role="search"');
  });
});
