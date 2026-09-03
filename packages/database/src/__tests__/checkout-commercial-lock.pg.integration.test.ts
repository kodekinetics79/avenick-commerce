import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { lockInventoryStockRows, lockProductCommercialRows } from "../services/checkout-invariants";
import { secureCreateOrder } from "../services/secure-checkout";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const createdOrderIds: string[] = [];
let buyerId = "";
let ownerId = "";
let sellerId = "";
let categoryId = "";
let productId = "";
let priceId = "";
let warehouseId = "";
let locationId = "";
let stockId = "";

const checkout = () => secureCreateOrder({
  userId: buyerId,
  type: "B2C",
  currency: "AED",
  items: [{ productId, quantity: 1 }],
  shippingAddress: { label: "Office", line1: "1 Race Street", city: "Dubai", country: "AE" },
});

async function waitForCommercialLockHolder(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const available = await db.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${`product-commercial:${productId}`})) AS acquired
    `;
    if (available[0]?.acquired === false) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for checkout to own the product-commercial lock");
}

beforeAll(async () => {
  const buyer = await db.user.create({ data: {
    email: `commercial-lock-buyer-${stamp}@example.test`, firstName: "Commercial", lastName: "Buyer",
    role: "CONSUMER", status: "ACTIVE",
  } });
  buyerId = buyer.id;
  const owner = await db.user.create({ data: {
    email: `commercial-lock-owner-${stamp}@example.test`, firstName: "Commercial", lastName: "Owner",
    role: "SELLER_OWNER", status: "ACTIVE",
  } });
  ownerId = owner.id;
  const seller = await db.sellerProfile.create({ data: {
    userId: owner.id, businessNameEn: `Commercial Lock ${stamp}`, crNumber: `LOCK-${stamp}`,
    type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE",
  } });
  sellerId = seller.id;
  const category = await db.category.create({ data: {
    nameEn: `Commercial Lock ${stamp}`, nameAr: `Commercial Lock ${stamp}`, slug: `commercial-lock-${stamp}`,
  } });
  categoryId = category.id;
  const product = await db.product.create({
    data: {
      sellerId: seller.id, categoryId: category.id, sku: `LOCK-${stamp}`, slug: `commercial-lock-product-${stamp}`,
      nameEn: "Commercial lock product", nameAr: "Commercial lock product", status: "ACTIVE", isB2CEnabled: true,
      prices: { create: { type: "B2C", currency: "AED", minQty: 1, price: 100, vatRate: 5 } },
    },
    include: { prices: true },
  });
  productId = product.id;
  priceId = product.prices[0]!.id;
  const warehouse = await db.warehouse.create({ data: {
    sellerId: seller.id, nameEn: `Commercial Lock Warehouse ${stamp}`, type: "SELLER", country: "AE", city: "Dubai",
  } });
  warehouseId = warehouse.id;
  const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: `LOCK-${stamp}` } });
  locationId = location.id;
  const stock = await db.inventoryStock.create({ data: { productId: product.id, locationId: location.id, qty: 20 } });
  stockId = stock.id;
});

afterAll(async () => {
  if (createdOrderIds.length) await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  if (stockId) await db.inventoryStock.deleteMany({ where: { id: stockId } });
  if (locationId) await db.inventoryLocation.deleteMany({ where: { id: locationId } });
  if (warehouseId) await db.warehouse.deleteMany({ where: { id: warehouseId } });
  if (productId) await db.product.deleteMany({ where: { id: productId } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  if (sellerId) await db.sellerProfile.deleteMany({ where: { id: sellerId } });
  await db.user.deleteMany({ where: { id: { in: [buyerId, ownerId].filter(Boolean) } } });
});

describe("checkout product-commercial serialization", () => {
  it("uses the current tier when a price mutation owns the commercial lock first", async () => {
    let release!: () => void;
    let locked!: () => void;
    const lockedSignal = new Promise<void>((resolve) => { locked = resolve; });
    const releaseSignal = new Promise<void>((resolve) => { release = resolve; });
    const mutation = db.$transaction(async (tx) => {
      await lockProductCommercialRows(tx, [productId]);
      await tx.productPrice.update({ where: { id: priceId }, data: { price: 125 } });
      locked();
      await releaseSignal;
    });
    await lockedSignal;
    const orderPromise = checkout();
    release();
    await mutation;
    const order = await orderPromise;
    createdOrderIds.push(order.id);
    expect(Number(order.items[0]!.unitPrice)).toBe(125);
  });

  it("rejects when a status mutation disables the product before checkout's locked re-read", async () => {
    let release!: () => void;
    let locked!: () => void;
    const lockedSignal = new Promise<void>((resolve) => { locked = resolve; });
    const releaseSignal = new Promise<void>((resolve) => { release = resolve; });
    const mutation = db.$transaction(async (tx) => {
      await lockProductCommercialRows(tx, [productId]);
      await tx.product.update({ where: { id: productId }, data: { status: "INACTIVE" } });
      locked();
      await releaseSignal;
    });
    await lockedSignal;
    const orderPromise = checkout();
    release();
    await mutation;
    await expect(orderPromise).rejects.toThrow(/unavailable/i);
    await db.product.update({ where: { id: productId }, data: { status: "ACTIVE" } });
  });

  it("lets checkout commit its locked price before a later price mutation", async () => {
    await db.productPrice.update({ where: { id: priceId }, data: { price: 140 } });
    let releaseStock!: () => void;
    let stockLocked!: () => void;
    const stockLockedSignal = new Promise<void>((resolve) => { stockLocked = resolve; });
    const releaseStockSignal = new Promise<void>((resolve) => { releaseStock = resolve; });
    const stockBlocker = db.$transaction(async (tx) => {
      await lockInventoryStockRows(tx, [stockId]);
      stockLocked();
      await releaseStockSignal;
    });
    await stockLockedSignal;

    const orderPromise = checkout();
    await waitForCommercialLockHolder();
    const mutation = db.$transaction(async (tx) => {
      await lockProductCommercialRows(tx, [productId]);
      await tx.productPrice.update({ where: { id: priceId }, data: { price: 175 } });
    });
    releaseStock();
    await stockBlocker;
    const order = await orderPromise;
    createdOrderIds.push(order.id);
    await mutation;

    expect(Number(order.items[0]!.unitPrice)).toBe(140);
    expect(Number((await db.productPrice.findUniqueOrThrow({ where: { id: priceId } })).price)).toBe(175);
  });
});
