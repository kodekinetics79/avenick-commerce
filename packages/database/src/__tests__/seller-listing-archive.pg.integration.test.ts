import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  ProductArchiveBlockedError,
  archiveSellerListing,
  restoreSellerListing,
} from "../services/seller-catalog";
import { integrationSuite } from "../testing/integration-db";

const run = integrationSuite();

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

let ownerId = "";
let sellerId = "";
let categoryId = "";
let warehouseId = "";
let locationId = "";
const productIds: string[] = [];

async function makeProduct(label: string) {
  const product = await db.product.create({
    data: {
      sellerId,
      categoryId,
      sku: `ARCH-${label}-${stamp}`,
      slug: `arch-${label}-${stamp}`,
      nameEn: `Archive fixture ${label} ${stamp}`,
      nameAr: `تجهيزة الأرشفة ${label}`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  productIds.push(product.id);
  return product.id;
}

run("archiving a seller's own listing", () => {
  beforeAll(async () => {
    const owner = await db.user.create({
      data: {
        email: `archive-owner-${stamp}@test.invalid`,
        firstName: "Archive",
        lastName: "Owner",
        role: "SELLER_OWNER",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    ownerId = owner.id;

    const seller = await db.sellerProfile.create({
      data: {
        userId: ownerId,
        businessNameEn: `Archive fixture seller ${stamp}`,
        crNumber: `ARCH-CR-${stamp}`,
        type: "DISTRIBUTOR",
        country: "AE",
        city: "Dubai",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    sellerId = seller.id;

    // Create the category rather than borrowing one. This used to be a
    // `findFirstOrThrow` for any active category, which passes on a database
    // some other suite has already populated and fails on a fresh one — so it
    // was green locally and red in CI, where the database is migrated but not
    // seeded. An integration test that depends on ambient rows is testing the
    // order it happened to run in.
    const category = await db.category.create({
      data: {
        nameEn: `Archive fixture ${stamp}`,
        nameAr: `Archive fixture ${stamp}`,
        slug: `archive-fixture-${stamp}`,
        isActive: true,
      },
      select: { id: true },
    });
    categoryId = category.id;

    const warehouse = await db.warehouse.create({
      data: { sellerId, nameEn: `Archive fixture WH ${stamp}`, type: "SELLER", country: "AE", city: "Dubai" },
      select: { id: true },
    });
    warehouseId = warehouse.id;
    const location = await db.inventoryLocation.create({
      data: { warehouseId, code: `ARCH-${stamp}` },
      select: { id: true },
    });
    locationId = location.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { sellerId } });
    await db.inventoryStock.deleteMany({ where: { productId: { in: productIds } } });
    await db.inventoryLocation.deleteMany({ where: { id: locationId } });
    await db.warehouse.deleteMany({ where: { id: warehouseId } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await db.sellerProfile.deleteMany({ where: { id: sellerId } });
    await db.user.deleteMany({ where: { id: ownerId } });
  });

  it("sets deletedAt, writes one DELETE audit row, and hides the listing from catalogue reads", async () => {
    const productId = await makeProduct("plain");
    const result = await archiveSellerListing({ productId, sellerId, actorId: ownerId });
    expect(result.archivedAt).toBeInstanceOf(Date);

    const row = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { deletedAt: true } });
    expect(row.deletedAt).not.toBeNull();

    // Every catalogue and seller list in the codebase filters `deletedAt: null`.
    // That filter is the whole mechanism, so the test asserts it rather than
    // trusting the column.
    await expect(
      db.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true } }),
    ).resolves.toBeNull();

    const audit = await db.auditLog.findMany({
      where: { entityType: "Product", entityId: productId, action: "DELETE" },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: ownerId, sellerId });
    expect(audit[0]!.after).toMatchObject({ archived: true });
  });

  it("refuses while stock is reserved, and names how many units", async () => {
    const productId = await makeProduct("reserved");
    await db.inventoryStock.create({ data: { productId, locationId, qty: 10, reservedQty: 3 } });

    const failure = await archiveSellerListing({ productId, sellerId, actorId: ownerId }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ProductArchiveBlockedError);
    expect((failure as ProductArchiveBlockedError).reason).toBe("RESERVED_STOCK");
    expect((failure as ProductArchiveBlockedError).count).toBe(3);
    // A refused archive must leave the listing exactly where it was: a
    // reservation pointing at a listing its owner can no longer see is the
    // failure this fence exists to prevent.
    const row = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { deletedAt: true } });
    expect(row.deletedAt).toBeNull();
  });

  it("archives once when the same listing is archived twice", async () => {
    const productId = await makeProduct("twice");
    await archiveSellerListing({ productId, sellerId, actorId: ownerId });
    await expect(archiveSellerListing({ productId, sellerId, actorId: ownerId })).rejects.toThrow(/not found/i);

    const audit = await db.auditLog.count({
      where: { entityType: "Product", entityId: productId, action: "DELETE" },
    });
    expect(audit).toBe(1);
  });

  it("restores an archived listing as a draft rather than back into the storefront", async () => {
    const productId = await makeProduct("restore");
    await archiveSellerListing({ productId, sellerId, actorId: ownerId });
    const restored = await restoreSellerListing({ productId, sellerId, actorId: ownerId });
    expect(restored.status).toBe("DRAFT");

    const row = await db.product.findUniqueOrThrow({
      where: { id: productId },
      select: { deletedAt: true, status: true },
    });
    // It was ACTIVE when archived. Coming back straight into the storefront
    // would republish a listing without anyone deciding to.
    expect(row).toMatchObject({ deletedAt: null, status: "DRAFT" });
  });

  it("refuses to archive a listing belonging to another seller", async () => {
    const productId = await makeProduct("foreign");
    // Create the other seller. This was a `findFirstOrThrow` for ANY seller
    // that is not ours, which finds one only when some other suite has already
    // made one — so it passed in a full run and threw "No SellerProfile found"
    // whenever this file ran first or alone. Same defect as the category
    // lookup above: the test was relying on its neighbours.
    const otherOwner = await db.user.create({
      data: {
        email: `archive-other-owner-${stamp}@test.invalid`,
        firstName: "Archive",
        lastName: "Other",
        role: "SELLER_OWNER",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    const otherSeller = await db.sellerProfile.create({
      data: {
        userId: otherOwner.id,
        businessNameEn: `Archive foreign seller ${stamp}`,
        crNumber: `ARCH-CR-OTHER-${stamp}`,
        type: "DISTRIBUTOR",
        country: "AE",
        city: "Dubai",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    await expect(
      archiveSellerListing({ productId, sellerId: otherSeller.id, actorId: ownerId }),
    ).rejects.toThrow();

    const row = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { deletedAt: true } });
    expect(row.deletedAt).toBeNull();
  });
});
