import { afterAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { applyPilotCatalog, type PilotCatalogFile } from "../services/pilot-catalog";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const cleanup = { users: [] as string[], sellers: [] as string[], products: [] as string[], categories: [] as string[] };

const row = (sku: string, overrides: Record<string, unknown> = {}) => ({
  sourceSheet: "Security Test",
  sourceRow: 1,
  sellerKey: "mennekes",
  sku,
  name: `Pilot ${sku}`,
  unitPriceSAR: 10,
  ...overrides,
});

afterAll(async () => {
  await db.product.deleteMany({ where: { id: { in: cleanup.products } } });
  await db.category.deleteMany({ where: { id: { in: cleanup.categories } } });
  await db.sellerProfile.deleteMany({ where: { id: { in: cleanup.sellers } } });
  await db.user.deleteMany({ where: { id: { in: cleanup.users } } });
});

describe("pilot import seller isolation and atomicity", () => {
  it("rejects a global SKU collision without transferring the foreign product", async () => {
    const owner = await db.user.create({ data: { email: `pilot-foreign-${stamp}@example.test`, firstName: "Foreign", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } });
    cleanup.users.push(owner.id);
    const seller = await db.sellerProfile.create({ data: { userId: owner.id, businessNameEn: `Foreign ${stamp}`, crNumber: `FOREIGN-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } });
    cleanup.sellers.push(seller.id);
    const category = await db.category.create({ data: { nameEn: `Foreign ${stamp}`, nameAr: `Foreign ${stamp}`, slug: `foreign-${stamp}` } });
    cleanup.categories.push(category.id);
    const sku = `FOREIGN-SKU-${stamp}`;
    const product = await db.product.create({ data: { sellerId: seller.id, categoryId: category.id, sku, slug: `foreign-product-${stamp}`, nameEn: "Foreign product", nameAr: "Foreign product" } });
    cleanup.products.push(product.id);

    await expect(applyPilotCatalog({ version: 1, records: [row(sku)] } as PilotCatalogFile))
      .rejects.toThrow(/already belongs/i);
    const unchanged = await db.product.findUnique({ where: { id: product.id } });
    expect(unchanged?.sellerId).toBe(seller.id);
    expect(unchanged?.nameEn).toBe("Foreign product");
  });

  it("rolls back earlier rows when a later row fails", async () => {
    const firstSku = `ATOMIC-ONE-${stamp}`;
    const secondSku = `ATOMIC-TWO-${stamp}`;
    const file = {
      version: 1,
      records: [
        row(firstSku),
        row(secondSku, { sourceRow: 2, unitPriceSAR: Number.POSITIVE_INFINITY }),
      ],
    } as PilotCatalogFile;

    await expect(applyPilotCatalog(file)).rejects.toThrow();
    expect(await db.product.findUnique({ where: { sku: firstSku } })).toBeNull();
    expect(await db.product.findUnique({ where: { sku: secondSku } })).toBeNull();
  });
});
