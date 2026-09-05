import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { listProducts, normalizeCatalogSearch } from "../services/products";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const ids = { user: "", seller: "", category: "", middleCategory: "", parentCategory: "", product: "", sparse: "", bare: "", brand: "" };
const brandSlug = `search-brand-${stamp}`;

beforeAll(async () => {
  const user = await db.user.create({
    data: { email: `catalog-search-${stamp}@example.test`, firstName: "Catalog", lastName: "Search", role: "SELLER_OWNER", status: "ACTIVE" },
  });
  ids.user = user.id;
  const seller = await db.sellerProfile.create({
    data: { userId: user.id, businessNameEn: `Catalog Search ${stamp}`, crNumber: `CAT-${stamp}`, type: "DISTRIBUTOR", country: "SA", city: "Riyadh", status: "ACTIVE" },
  });
  ids.seller = seller.id;
  const parentCategory = await db.category.create({ data: { nameEn: `Search parent ${stamp}`, nameAr: "Search", slug: `search-parent-${stamp}` } });
  ids.parentCategory = parentCategory.id;
  const middleCategory = await db.category.create({ data: { nameEn: `Search middle ${stamp}`, nameAr: "Search", slug: `search-middle-${stamp}`, parentId: parentCategory.id } });
  ids.middleCategory = middleCategory.id;
  const category = await db.category.create({ data: { nameEn: `Search ${stamp}`, nameAr: "Search", slug: `search-${stamp}`, parentId: middleCategory.id } });
  ids.category = category.id;
  const product = await db.product.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      sku: `CAT-SKU-${stamp}`,
      slug: `catalog-search-${stamp}`,
      nameEn: `Alpha Conduit Adapter ${stamp}`,
      nameAr: "وصلة ألفا",
      status: "ACTIVE",
      isPubliclyDiscoverable: true,
      isB2CEnabled: false,
      isB2BEnabled: true,
      commercialMetadata: {
        create: {
          sourceSystem: "CLIENT_PILOT_CATALOG",
          manufacturerPartNumber: "1145A",
          supplierPartNumber: `SUP-35-Green-${stamp}`,
          externalItemNumber: "3459",
          erpCode: `ERP-811-${stamp}`,
          sourceFingerprint: `fingerprint-${stamp}`,
        },
      },
    },
  });
  ids.product = product.id;

  /*
    Two more products, in the shapes the LIVE catalogue is full of and this
    fixture had none of.

    The product above sets all four identifier columns, so nothing in its
    metadata row is NULL. That is what hid the search defect for as long as it
    existed: every tier below the first is "matches me AND NOT any tier above
    me", Prisma compiles the metadata filter as a LEFT JOIN with column
    comparisons, and `NULL IN (...)` is NULL — so `NOT (FALSE OR NULL)` is NULL
    and the row is dropped. With every column populated the comparison is FALSE
    rather than NULL and the exclusion behaves. Production is not like that:
    an imported catalogue fills the columns it has and leaves the rest NULL.

    `sparse` has a metadata row with the identifier columns NULL. `bare` has no
    metadata row at all. Both must still be findable by a word from their name.
  */
  const brand = await db.brand.create({ data: { nameEn: `Search Brand ${stamp}`, slug: brandSlug } });
  ids.brand = brand.id;

  const sparse = await db.product.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      brandId: brand.id,
      sku: `CAT-SPARSE-${stamp}`,
      slug: `catalog-search-sparse-${stamp}`,
      nameEn: `Beta Conduit Coupler ${stamp}`,
      nameAr: "وصلة بيتا",
      status: "ACTIVE",
      isPubliclyDiscoverable: true,
      isB2CEnabled: false,
      isB2BEnabled: true,
      commercialMetadata: {
        create: {
          sourceSystem: "CLIENT_PILOT_CATALOG",
          sourceFingerprint: `fingerprint-sparse-${stamp}`,
        },
      },
    },
  });
  ids.sparse = sparse.id;

  const bare = await db.product.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      sku: `CAT-BARE-${stamp}`,
      slug: `catalog-search-bare-${stamp}`,
      nameEn: `Gamma Conduit Bracket ${stamp}`,
      nameAr: "حامل غاما",
      status: "ACTIVE",
      isPubliclyDiscoverable: true,
      isB2CEnabled: false,
      isB2BEnabled: true,
    },
  });
  ids.bare = bare.id;
});

afterAll(async () => {
  const productIds = [ids.product, ids.sparse, ids.bare].filter(Boolean);
  if (productIds.length) await db.product.deleteMany({ where: { id: { in: productIds } } });
  if (ids.category) await db.category.deleteMany({ where: { id: ids.category } });
  if (ids.middleCategory) await db.category.deleteMany({ where: { id: ids.middleCategory } });
  if (ids.parentCategory) await db.category.deleteMany({ where: { id: ids.parentCategory } });
  if (ids.brand) await db.brand.deleteMany({ where: { id: ids.brand } });
  if (ids.seller) await db.sellerProfile.deleteMany({ where: { id: ids.seller } });
  if (ids.user) await db.user.deleteMany({ where: { id: ids.user } });
});

async function expectSearch(term: string) {
  const result = await listProducts({ search: term, status: "ACTIVE", publiclyDiscoverable: true, limit: 10 });
  expect(result.products.map((product) => product.id)).toContain(ids.product);
  return result;
}

describe("catalog discovery search", () => {
  it("normalizes only surrounding/repeated whitespace and preserves punctuation", () => {
    expect(normalizeCatalogSearch("  35-Green  ")).toBe("35-Green");
    expect(normalizeCatalogSearch(" Alpha   Conduit ")).toBe("Alpha Conduit");
    expect(normalizeCatalogSearch("   ")).toBeUndefined();
  });

  it("searches SKU, name, manufacturer, supplier, external item, and ERP identifiers without N+1 metadata reads", async () => {
    await expectSearch(`cat-sku-${stamp}`);
    await expectSearch("Alpha Conduit");
    await expectSearch("  1145a  ");
    await expectSearch("35-Green");
    await expectSearch("3459");
    const result = await expectSearch(`811-${stamp}`);
    expect(JSON.stringify(result.products)).not.toContain("manufacturerPartNumber");
    expect(JSON.stringify(result.products)).not.toContain("sourceFingerprint");
  });

  /**
   * THE DEFECT THIS FILE EXISTED FOR AND STILL MISSED.
   *
   * Any term without a space is identifier-shaped, so a single-word search runs
   * the identifier tiers AND the free-text tier. The free-text tier then
   * subtracts the identifier tiers, and that subtraction was poisoned by NULL
   * for every product whose metadata columns are not all populated — which, in
   * an imported catalogue, is most of them.
   *
   * Measured on the live catalogue before the fix: `cable` returned 0 products
   * while 13 carried "Cable" in their name. `cable management` returned 10,
   * because a term with a space is not identifier-shaped and skips the tiers
   * that poisoned it. A storefront whose one-word searches all answer "nothing"
   * is not a storefront.
   */
  it("finds every product by a single word from its name, whatever its metadata holds", async () => {
    const result = await listProducts({ search: "Conduit", status: "ACTIVE", publiclyDiscoverable: true, limit: 50 });
    const found = result.products.map((product) => product.id);

    expect(found, "the product with a fully populated metadata row").toContain(ids.product);
    expect(found, "the product whose identifier columns are NULL — the shape an import produces").toContain(ids.sparse);
    expect(found, "the product with no metadata row at all").toContain(ids.bare);
  });

  it("answers a one-word search the same way it answers the same word inside a phrase", async () => {
    // A term with a space is not identifier-shaped and therefore never ran the
    // tiers that were broken. If these two disagree, the identifier path is
    // discarding name matches again.
    const [oneWord, phrase] = await Promise.all([
      listProducts({ search: "Conduit", status: "ACTIVE", publiclyDiscoverable: true, limit: 50 }),
      listProducts({ search: `Conduit Coupler ${stamp}`, status: "ACTIVE", publiclyDiscoverable: true, limit: 50 }),
    ]);

    expect(oneWord.products.map((p) => p.id)).toContain(ids.sparse);
    expect(phrase.products.map((p) => p.id)).toContain(ids.sparse);
  });

  it("still ranks an exact identifier first, which is why the tiers exist", async () => {
    const result = await listProducts({ search: `CAT-SKU-${stamp}`, status: "ACTIVE", publiclyDiscoverable: true, limit: 10 });
    expect(result.products[0]?.id).toBe(ids.product);
  });

  /**
   * The same NULL propagation, one tier further down. The free-text tier is
   * subtracted from the brand tier, and `NULL ILIKE '%term%'` is NULL — so a
   * product findable only by its brand was discarded for every row whose
   * metadata carries a NULL identifier column, which on the live catalogue is
   * 368 of 383.
   */
  it("finds a product by its brand when the product's metadata columns are NULL", async () => {
    const result = await listProducts({ search: brandSlug, status: "ACTIVE", publiclyDiscoverable: true, limit: 50 });
    expect(result.products.map((product) => product.id)).toContain(ids.sparse);
  });

  it("returns no products for an unknown identifier", async () => {
    const result = await listProducts({ search: `UNKNOWN-${stamp}`, status: "ACTIVE", publiclyDiscoverable: true, limit: 10 });
    expect(result.total).toBe(0);
    expect(result.products).toEqual([]);
  });

  it("includes leaf products through every level of the parent hierarchy", async () => {
    const parent = await listProducts({ categorySlug: `search-parent-${stamp}`, status: "ACTIVE", publiclyDiscoverable: true, limit: 10 });
    const middle = await listProducts({ categorySlug: `search-middle-${stamp}`, status: "ACTIVE", publiclyDiscoverable: true, limit: 10 });
    const leaf = await listProducts({ categorySlug: `search-${stamp}`, status: "ACTIVE", publiclyDiscoverable: true, limit: 10 });
    expect(parent.products.map((product) => product.id)).toContain(ids.product);
    expect(middle.products.map((product) => product.id)).toContain(ids.product);
    expect(leaf.products.map((product) => product.id)).toContain(ids.product);
  });

  it("installs trigram indexes for contains searches at larger catalog scale", async () => {
    const expected = [
      "Product_nameEn_trgm_idx", "Product_nameAr_trgm_idx", "Product_sku_trgm_idx",
      "ProductCommercialMetadata_mpn_trgm_idx", "ProductCommercialMetadata_spn_trgm_idx",
      "ProductCommercialMetadata_external_trgm_idx", "ProductCommercialMetadata_erp_trgm_idx",
    ];
    const rows = await db.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE indexname IN (
        'Product_nameEn_trgm_idx', 'Product_nameAr_trgm_idx', 'Product_sku_trgm_idx',
        'ProductCommercialMetadata_mpn_trgm_idx', 'ProductCommercialMetadata_spn_trgm_idx',
        'ProductCommercialMetadata_external_trgm_idx', 'ProductCommercialMetadata_erp_trgm_idx'
      )
    `;
    expect(rows.map((row) => row.indexname).sort()).toEqual(expected.sort());
  });
});
