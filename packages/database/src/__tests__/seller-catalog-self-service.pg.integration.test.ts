import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { createSellerCatalogListing, updateSellerCatalogListing } from "../services/seller-catalog";

const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const ids = { users: [] as string[], sellers: [] as string[], products: [] as string[] };
let sellerA = "", sellerB = "", ownerA = "", ownerB = "", deniedStaff = "", categoryId = "";

beforeAll(async () => {
  const users = await Promise.all([
    db.user.create({ data: { email: `catalog-owner-a-${stamp}@test.invalid`, firstName: "Owner", lastName: "A", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `catalog-owner-b-${stamp}@test.invalid`, firstName: "Owner", lastName: "B", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `catalog-staff-${stamp}@test.invalid`, firstName: "Catalog", lastName: "Only", role: "SELLER_STAFF", status: "ACTIVE" } }),
  ]);
  [ownerA, ownerB, deniedStaff] = users.map((user) => user.id);
  ids.users.push(...users.map((user) => user.id));
  const sellers = await Promise.all([
    db.sellerProfile.create({ data: { userId: ownerA, businessNameEn: `Catalog A ${stamp}`, crNumber: `CAT-A-${stamp}`, type: "DISTRIBUTOR", country: "SA", city: "Riyadh", status: "ACTIVE" } }),
    db.sellerProfile.create({ data: { userId: ownerB, businessNameEn: `Catalog B ${stamp}`, crNumber: `CAT-B-${stamp}`, type: "DISTRIBUTOR", country: "SA", city: "Jeddah", status: "ACTIVE" } }),
  ]);
  [sellerA, sellerB] = sellers.map((seller) => seller.id);
  ids.sellers.push(sellerA, sellerB);
  await db.sellerMembership.create({ data: { userId: deniedStaff, sellerId: sellerA, permissions: ["catalog.manage"], isActive: true } });
  categoryId = (await db.category.create({ data: { nameEn: `Catalog ${stamp}`, nameAr: `Catalog ${stamp}`, slug: `catalog-self-${stamp}` } })).id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: { in: ids.users } } });
  await db.product.deleteMany({ where: { id: { in: ids.products } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  await db.sellerMembership.deleteMany({ where: { userId: deniedStaff } });
  await db.sellerProfile.deleteMany({ where: { id: { in: ids.sellers } } });
  await db.user.deleteMany({ where: { id: { in: ids.users } } });
});

const listing = () => ({
  categoryId,
  sku: `SELF-${stamp}`,
  nameEn: "Saudi industrial breaker",
  nameAr: "قاطع صناعي سعودي",
  descriptionEn: "Governed seller-submitted industrial listing.",
  imageUrl: "https://www.mennekes.org/fileadmin/products_media/breaker.jpg",
  origin: "SA" as const,
  moq: 2,
  currency: "SAR" as const,
  vatRate: 15,
  b2bPrice: 250,
  b2cPrice: null,
});

run("seller catalog self-service", () => {
  it("creates a seller-owned listing as review-only with truthful commercial identity", async () => {
    const product = await createSellerCatalogListing({ actorId: ownerA, sellerId: sellerA, ...listing() });
    ids.products.push(product.id);
    const stored = await db.product.findUniqueOrThrow({ where: { id: product.id }, include: { prices: true, images: true } });
    expect(stored).toMatchObject({ sellerId: sellerA, status: "PENDING_REVIEW", isPubliclyDiscoverable: true, isB2BEnabled: true, isB2CEnabled: false, publishedAt: null });
    expect(stored.prices).toHaveLength(1);
    expect(stored.prices[0]).toMatchObject({ type: "B2B", currency: "SAR", minQty: 2, isActive: true });
    expect(Number(stored.prices[0]!.vatRate)).toBe(15);
    expect(stored.images[0]?.isPrimary).toBe(true);
  });

  it("returns an active listing to review and never lets another seller edit it", async () => {
    const productId = ids.products[0]!;
    await db.product.update({ where: { id: productId }, data: { status: "ACTIVE", publishedAt: new Date() } });
    const updated = await updateSellerCatalogListing({ productId, actorId: ownerA, sellerId: sellerA, ...listing(), nameEn: "Revised industrial breaker" });
    expect(updated).toMatchObject({ status: "PENDING_REVIEW", publishedAt: null, nameEn: "Revised industrial breaker" });
    await expect(updateSellerCatalogListing({ productId, actorId: ownerB, sellerId: sellerB, ...listing() })).rejects.toThrow(/not found in this seller account/i);
  });

  it("requires pricing authority in the locked transaction", async () => {
    await expect(createSellerCatalogListing({ actorId: deniedStaff, sellerId: sellerA, ...listing(), sku: `DENIED-${stamp}` })).rejects.toThrow(/pricing\.manage/i);
    expect(await db.product.count({ where: { sku: `DENIED-${stamp}` } })).toBe(0);
  });
});
