import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(resolve(here, "../page.tsx"), "utf8");
const sortSelect = readFileSync(resolve(here, "../../components/products/sort-select.tsx"), "utf8");

/** The source of the ProductRail helper alone, so assertions cannot pass on text elsewhere in the page. */
function productRailSource(): string {
  const start = page.indexOf("function ProductRail(");
  const end = page.indexOf("\nfunction ", start + 1);
  expect(start).toBeGreaterThan(-1);
  return page.slice(start, end === -1 ? undefined : end);
}

/**
 * The home page's three product rails were ten tiles in a two-column grid on a
 * phone: five rows of about 480px each, so the rails were 7,700px of an
 * 11,300px page and the first product card sat on the third screen. Every
 * rail's "View all" went to plain /products, including Top rated, and the
 * "More from the marketplace" subtitle promised "key categories" for a rail
 * that is simply the next-newest products.
 */
describe("home page product rails", () => {
  it("lays the same tiles out as one horizontal row on a phone, without rendering them twice", () => {
    const rail = productRailSource();
    // The scroller exists only under sm and hands it ProductGrid's tiles.
    expect(rail).toContain("max-sm:grid-flow-col");
    expect(rail).toContain("max-sm:overflow-x-auto");
    expect(rail).toContain("max-sm:[&>div]:contents");
    // One rendering: a single ProductGrid and a single map over the rows.
    expect(rail.match(/<ProductGrid\b/g)).toHaveLength(1);
    expect(rail.match(/rows\.map\(/g)).toHaveLength(1);
    // A phone tile limit would hide tiles inside a row that costs no height.
    expect(rail).not.toMatch(/phoneLimit/);
    // The scrollbar is the row's only affordance, so it must not be hidden.
    expect(rail).not.toContain("scrollbar-hide");
  });

  it("does not hold a swiped-to tile back behind its reveal on a phone", () => {
    // RevealRoot hides any [data-reveal] off screen at first sighting, and a
    // tile clipped by the row's own scroller counts as off screen — so every
    // swipe used to land on an empty plate that faded in afterwards. The
    // override must out-rank `[data-reveal][data-reveal-state="hidden"]`
    // (two attribute selectors) and apply only under sm.
    const rail = productRailSource();
    expect(rail).toContain("max-sm:[&[data-reveal][data-reveal-state=hidden]]:opacity-100");
    expect(rail).toContain("max-sm:[&[data-reveal][data-reveal-state=hidden]]:[transform:none]");
  });

  it("continues Top rated on the catalogue's own rating sort", () => {
    expect(page).toMatch(/title=\{t\("topRated"\)\}[\s\S]*?href="\/products\?sort=rating"/);
    expect(sortSelect).toContain('value="rating"');
  });

  it("does not describe the next-newest products as a category selection", () => {
    expect(en.home.featuredProductsSub).not.toMatch(/categor/i);
    expect(ar.home.featuredProductsSub).not.toMatch(/الفئات/);
  });
});
