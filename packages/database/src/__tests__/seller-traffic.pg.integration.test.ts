import { afterAll, beforeAll, expect, it } from "vitest";
import { db } from "../index";
import { loadSellerListingTraffic } from "../services/seller-traffic";
import { integrationSuite } from "../testing/integration-db";

const run = integrationSuite();

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

let ownerId = "";
let buyerId = "";
let sellerId = "";
let categoryId = "";
const productIds: string[] = [];
const orderIds: string[] = [];

/** A UTC day-start bucket `n` days ago, which is what ProductViewSignal stores. */
function bucket(daysAgo: number): Date {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function makeProduct(label: string) {
  const product = await db.product.create({
    data: {
      sellerId,
      categoryId,
      sku: `TRAF-${label}-${stamp}`,
      slug: `traf-${label}-${stamp}`,
      nameEn: `Traffic fixture ${label}`,
      nameAr: `تجهيزة ${label}`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  productIds.push(product.id);
  return product.id;
}

async function addViews(productId: string, views: number, daysAgo: number) {
  await db.productViewSignal.create({ data: { productId, bucketDate: bucket(daysAgo), views } });
}

/** One paid order line for `productId`, placed `daysAgo`, in `currency`. */
async function addOrderLine(productId: string, quantity: number, total: number, currency: "AED" | "SAR", daysAgo: number) {
  const placedAt = new Date(Date.now() - daysAgo * 86_400_000);
  const order = await db.order.create({
    data: {
      orderNumber: `TRAF-${stamp}-${orderIds.length}`,
      userId: buyerId,
      type: "B2C",
      shippingAddress: { line1: "Traffic fixture", city: "Dubai", country: "AE" },
      status: "DELIVERED",
      paymentStatus: "PAID",
      currency,
      subtotal: total,
      vatAmount: 0,
      total,
      createdAt: placedAt,
    },
    select: { id: true },
  });
  orderIds.push(order.id);
  await db.orderItem.create({
    data: {
      orderId: order.id,
      sellerId,
      productId,
      sku: `TRAF-${stamp}`,
      nameEn: "Traffic fixture line",
      nameAr: "سطر تجهيزة",
      quantity,
      unitPrice: total / quantity,
      vatAmount: 0,
      total,
      status: "DELIVERED",
      createdAt: placedAt,
    },
  });
}

run("seller listing traffic and conversion", () => {
  beforeAll(async () => {
    const owner = await db.user.create({
      data: { email: `traffic-owner-${stamp}@test.invalid`, firstName: "T", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" },
      select: { id: true },
    });
    ownerId = owner.id;
    const buyer = await db.user.create({
      data: { email: `traffic-buyer-${stamp}@test.invalid`, firstName: "T", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" },
      select: { id: true },
    });
    buyerId = buyer.id;
    const seller = await db.sellerProfile.create({
      data: {
        userId: ownerId,
        businessNameEn: `Traffic fixture seller ${stamp}`,
        crNumber: `TRAF-CR-${stamp}`,
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
    categoryId = (
      await db.category.create({
        data: {
          nameEn: `Traffic fixture ${stamp}`,
          nameAr: `Traffic fixture ${stamp}`,
          slug: `traffic-fixture-${stamp}`,
          isActive: true,
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
    await db.productViewSignal.deleteMany({ where: { productId: { in: productIds } } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await db.sellerProfile.deleteMany({ where: { id: sellerId } });
    await db.user.deleteMany({ where: { id: { in: [ownerId, buyerId] } } });
  });

  it("reports views, units and conversion, and omits listings with neither", async () => {
    const leaking = await makeProduct("leaking");
    const converting = await makeProduct("converting");
    await makeProduct("silent"); // no views, no orders — must not appear at all

    await addViews(leaking, 100, 3);
    await addOrderLine(leaking, 2, 200, "AED", 2);
    await addViews(converting, 20, 3);
    await addOrderLine(converting, 10, 1000, "AED", 2);

    const report = await loadSellerListingTraffic(sellerId);
    const bySku = new Map(report.rows.map((row) => [row.sku, row]));

    expect(bySku.get(`TRAF-silent-${stamp}`)).toBeUndefined();
    expect(bySku.get(`TRAF-leaking-${stamp}`)).toMatchObject({ views: 100, unitsOrdered: 2, conversion: 0.02 });
    expect(bySku.get(`TRAF-converting-${stamp}`)).toMatchObject({ views: 20, unitsOrdered: 10, conversion: 0.5 });

    // The listing wasting the most attention is the one to work on, and it is
    // not the one with the worst ratio in isolation nor the one with the most
    // views — it is the product of the two.
    expect(report.rows[0]!.sku).toBe(`TRAF-leaking-${stamp}`);
    expect(report.totals).toMatchObject({ views: 120, unitsOrdered: 12 });
  });

  it("counts conversion across every currency but reports money in one", async () => {
    const mixed = await makeProduct("mixed");
    await addViews(mixed, 50, 2);
    await addOrderLine(mixed, 3, 300, "AED", 1);
    await addOrderLine(mixed, 3, 300, "AED", 1);
    await addOrderLine(mixed, 4, 400, "SAR", 1);

    const report = await loadSellerListingTraffic(sellerId);
    const row = report.rows.find((r) => r.sku === `TRAF-mixed-${stamp}`)!;

    // A view carries no currency. Dividing AED-only units by all-currency views
    // would understate conversion for exactly the sellers trading most widely.
    expect(row.unitsOrdered).toBe(10);
    expect(row.conversion).toBeCloseTo(0.2, 5);
    // Money is never added across currencies on this platform.
    expect(report.currency).toBe("AED");
    expect(row.orderedProductSales).toBe(600);
    expect(report.excludedCurrencies).toContain("SAR");
    expect(report.excludedLineCount).toBeGreaterThanOrEqual(1);
  });

  it("states no conversion at all for a listing nobody viewed", async () => {
    const unseen = await makeProduct("unseen");
    await addOrderLine(unseen, 1, 99, "AED", 1);

    const report = await loadSellerListingTraffic(sellerId);
    const row = report.rows.find((r) => r.sku === `TRAF-unseen-${stamp}`)!;
    // Null, never 0: it sold without a recorded view, which is a gap in
    // measurement, not a listing that converts at zero percent.
    expect(row.views).toBe(0);
    expect(row.conversion).toBeNull();
  });

  it("ignores views and orders older than the window", async () => {
    const stale = await makeProduct("stale");
    await addViews(stale, 500, 90);
    await addOrderLine(stale, 9, 900, "AED", 90);

    const report = await loadSellerListingTraffic(sellerId, { windowDays: 30 });
    expect(report.rows.find((r) => r.sku === `TRAF-stale-${stamp}`)).toBeUndefined();
  });
});
