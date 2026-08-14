import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { lockInventoryStockRows } from "../services/checkout-invariants";
import { lockPromotionCommercialRows } from "../services/promotions";
import { secureCreateOrder } from "../services/secure-checkout";

const run = process.env.DATABASE_URL ? describe : describe.skip;
const stamp = `promotion-mode-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
let buyerId = "";
let ownerId = "";
let sellerId = "";
let categoryId = "";
let productId = "";
let warehouseId = "";
let locationId = "";
let stockId = "";
let promotionId = "";

async function waitForCheckoutAtInventoryFence() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiting = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND wait_event = 'advisory'
        AND query LIKE '%pg_advisory_xact_lock%'
    `;
    if (Number(waiting[0]?.count ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for checkout at the inventory fence");
}

run("promotion mode mutation and checkout serialization", () => {
  beforeAll(async () => {
    const [buyer, owner] = await Promise.all([
      db.user.create({ data: { email: `${stamp}-buyer@example.test`, firstName: "Promotion", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" } }),
      db.user.create({ data: { email: `${stamp}-owner@example.test`, firstName: "Promotion", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
    ]);
    buyerId = buyer.id;
    ownerId = owner.id;
    const seller = await db.sellerProfile.create({ data: {
      userId: owner.id, businessNameEn: stamp, crNumber: `PROMO-${stamp}`, type: "DISTRIBUTOR",
      country: "AE", city: "Dubai", status: "ACTIVE",
    } });
    sellerId = seller.id;
    const category = await db.category.create({ data: { nameEn: stamp, nameAr: stamp, slug: stamp } });
    categoryId = category.id;
    const product = await db.product.create({ data: {
      sellerId, categoryId, sku: `SKU-${stamp}`, slug: `sku-${stamp}`, nameEn: stamp, nameAr: stamp,
      status: "ACTIVE", isB2CEnabled: true,
      prices: { create: { type: "B2C", currency: "AED", price: 100, vatRate: 5 } },
    } });
    productId = product.id;
    const warehouse = await db.warehouse.create({ data: { sellerId, nameEn: stamp, type: "SELLER", country: "AE", city: "Dubai" } });
    warehouseId = warehouse.id;
    const location = await db.inventoryLocation.create({ data: { warehouseId, code: stamp } });
    locationId = location.id;
    const stock = await db.inventoryStock.create({ data: { productId, locationId, qty: 10 } });
    stockId = stock.id;
    const promotion = await db.commercePromotion.create({ data: {
      name: stamp, type: "PERCENTAGE", status: "ACTIVE", scope: "PLATFORM", currency: "AED", value: 20,
      eligibility: {},
    } });
    promotionId = promotion.id;
  });

  afterAll(async () => {
    await db.order.deleteMany({ where: { userId: buyerId } });
    await db.promotionCoupon.deleteMany({ where: { promotionId } });
    await db.commercePromotion.deleteMany({ where: { id: promotionId } });
    await db.inventoryStock.deleteMany({ where: { id: stockId } });
    await db.inventoryLocation.deleteMany({ where: { id: locationId } });
    await db.warehouse.deleteMany({ where: { id: warehouseId } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.sellerProfile.deleteMany({ where: { id: sellerId } });
    await db.user.deleteMany({ where: { id: { in: [buyerId, ownerId].filter(Boolean) } } });
  });

  it("never redeems a stale automatic evaluation after the promotion becomes coupon-only", async () => {
    let release!: () => void;
    let locked!: () => void;
    const releaseSignal = new Promise<void>((resolve) => { release = resolve; });
    const lockedSignal = new Promise<void>((resolve) => { locked = resolve; });
    const blocker = db.$transaction(async (tx) => {
      await lockInventoryStockRows(tx, [stockId]);
      locked();
      await releaseSignal;
    });
    await lockedSignal;

    const checkout = secureCreateOrder({
      userId: buyerId, type: "B2C", currency: "AED", items: [{ productId, quantity: 1 }],
      shippingAddress: { label: "Office", line1: "1 Race Street", city: "Dubai", country: "AE" },
    });
    await waitForCheckoutAtInventoryFence();
    await db.$transaction(async (tx) => {
      await lockPromotionCommercialRows(tx, [promotionId]);
      await tx.commercePromotion.update({ where: { id: promotionId }, data: { eligibility: { requiresCoupon: true } } });
      await tx.promotionCoupon.create({ data: { promotionId, code: `CODE-${stamp}`.toUpperCase() } });
    });
    release();
    await blocker;

    const outcome = await checkout.then((order) => ({ order }), (error: unknown) => ({ error }));
    if ("order" in outcome) expect(Number(outcome.order.discountAmount)).toBe(0);
    else expect(String(outcome.error)).toMatch(/coupon-only/i);
    await expect(db.promotionRedemption.count({ where: { promotionId } })).resolves.toBe(0);
  });
});
