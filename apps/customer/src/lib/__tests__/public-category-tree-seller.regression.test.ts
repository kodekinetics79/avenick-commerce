import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../public-category-tree.ts"), "utf8");

/**
 * The category tree must apply the same seller rule as every listing.
 *
 * THE DEFECT. The tree's `visible` test kept a category when it held an ACTIVE,
 * undeleted, discoverable product, and never looked at the product's seller.
 * Every listing (listProducts, publicProductWhere) also requires the seller to
 * be ACTIVE and not deleted. rejectSeller moves a seller to REJECTED and leaves
 * its products alone, so a category whose only product belonged to a rejected
 * seller stayed in the header menu and in /sitemap.xml while its page listed
 * nothing: an indexable empty shelf, named from a revoked seller's import.
 *
 * The query is raw SQL, so this reads it rather than running it; the database
 * integration suites run only against a local database by consent.
 */
describe("readPublicCategoryTree seller rule", () => {
  const visible = source.slice(source.indexOf("WITH RECURSIVE visible AS"), source.indexOf("keep AS"));

  it("keeps a category only for a product whose seller is ACTIVE and not deleted", () => {
    expect(visible).toMatch(/FROM "SellerProfile" s/);
    expect(visible).toMatch(/s\."id" = p\."sellerId"/);
    expect(visible).toMatch(/s\."status" = 'ACTIVE'/);
    expect(visible).toMatch(/s\."deletedAt" IS NULL/);
  });
});
