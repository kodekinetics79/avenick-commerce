import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { listProducts, normalizeCatalogSearch } from "../services/products";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const ids = { user: "", seller: "", category: "", middleCategory: "", parentCategory: "", product: "" };

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
});

afterAll(async () => {
  if (ids.product) await db.product.deleteMany({ where: { id: ids.product } });
  if (ids.category) await db.category.deleteMany({ where: { id: ids.category } });
  if (ids.middleCategory) await db.category.deleteMany({ where: { id: ids.middleCategory } });
  if (ids.parentCategory) await db.category.deleteMany({ where: { id: ids.parentCategory } });
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
