import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { listProducts } from "../services/products";

/**
 * Every tile on /brands links to /products?brand=<slug>. Before this filter
 * existed the parameter was ignored, so the page presented the ENTIRE catalogue
 * as one brand's listings — a wrong answer delivered confidently, which is the
 * failure mode this codebase treats as unsurvivable.
 *
 * Skipped without DATABASE_URL, like the other pg suites.
 */
const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const stamp = `brand-filter-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const created = { users: [] as string[], sellers: [] as string[], categories: [] as string[], brands: [] as string[], products: [] as string[] };
let brandSlug = "";
let otherBrandSlug = "";

async function makeProduct(name: string, brandId: string | null) {
  const product = await db.product.create({
    data: {
      sellerId: created.sellers[0]!,
      categoryId: created.categories[0]!,
      brandId,
      sku: `${stamp}-${name}`,
      slug: `${stamp}-${name}`.toLowerCase(),
      nameEn: `${name} ${stamp}`,
      nameAr: `${name} ${stamp}`,
      status: "ACTIVE",
      isPubliclyDiscoverable: true,
      isB2CEnabled: true,
      publishedAt: new Date(),
    },
  });
  created.products.push(product.id);
  return product;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const owner = await db.user.create({ data: { email: `${stamp}@test.invalid`, firstName: "Brand", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } });
  created.users.push(owner.id);
  const seller = await db.sellerProfile.create({
    data: { userId: owner.id, businessNameEn: `Brand seller ${stamp}`, crNumber: `CR-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" },
  });
  created.sellers.push(seller.id);
  const category = await db.category.create({ data: { nameEn: stamp, nameAr: stamp, slug: `cat-${stamp}`, isActive: true } });
  created.categories.push(category.id);

  brandSlug = `brand-a-${stamp}`;
  otherBrandSlug = `brand-b-${stamp}`;
  const [a, b] = await Promise.all([
    db.brand.create({ data: { nameEn: `A ${stamp}`, nameAr: `A ${stamp}`, slug: brandSlug } }),
    db.brand.create({ data: { nameEn: `B ${stamp}`, nameAr: `B ${stamp}`, slug: otherBrandSlug } }),
  ]);
  created.brands.push(a.id, b.id);

  await makeProduct("owned", a.id);
  await makeProduct("other", b.id);
  await makeProduct("unbranded", null);
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await db.product.deleteMany({ where: { id: { in: created.products } } });
  await db.brand.deleteMany({ where: { id: { in: created.brands } } });
  await db.category.deleteMany({ where: { id: { in: created.categories } } });
  await db.sellerProfile.deleteMany({ where: { id: { in: created.sellers } } });
  await db.user.deleteMany({ where: { id: { in: created.users } } });
});

run("catalog brand filter", () => {
  it("returns only the requested brand's products", async () => {
    const result = await listProducts({ brandSlug, status: "ACTIVE", publiclyDiscoverable: true, limit: 50 });
    const names = result.products.map((p) => p.nameEn);
    expect(names).toHaveLength(1);
    expect(names[0]).toContain("owned");
  });

  it("excludes a product with no brand, rather than matching a null relation", async () => {
    const result = await listProducts({ brandSlug, status: "ACTIVE", publiclyDiscoverable: true, limit: 50 });
    expect(result.products.map((p) => p.nameEn).join(" ")).not.toContain("unbranded");
  });

  it("paginates against the filtered set, so the total matches the rows", async () => {
    const result = await listProducts({ brandSlug, status: "ACTIVE", publiclyDiscoverable: true, limit: 50 });
    expect(result.total).toBe(result.products.length);
  });

  it("an unknown brand returns nothing rather than the whole catalogue", async () => {
    const result = await listProducts({ brandSlug: `${stamp}-no-such-brand`, status: "ACTIVE", publiclyDiscoverable: true, limit: 50 });
    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
