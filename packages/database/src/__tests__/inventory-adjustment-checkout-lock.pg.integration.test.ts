import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, db } from "../index";
import { adjustInventory } from "../services/inventory";
import { secureCreateOrder } from "../services/secure-checkout";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const created = { users: [] as string[], sellers: [] as string[], products: [] as string[], orders: [] as string[] };
let buyerId = "";
let sellerId = "";
let categoryId = "";
let productId = "";
let stockId = "";
let warehouseId = "";
let locationId = "";

beforeAll(async () => {
  const [buyer, owner] = await Promise.all([
    db.user.create({ data: { email: `stock-race-buyer-${stamp}@example.test`, firstName: "Stock", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `stock-race-owner-${stamp}@example.test`, firstName: "Stock", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  created.users.push(buyer.id, owner.id);
  buyerId = buyer.id;
  const seller = await db.sellerProfile.create({ data: {
    userId: owner.id, businessNameEn: `Stock Race ${stamp}`, crNumber: `STOCK-${stamp}`,
    type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE",
  } });
  created.sellers.push(seller.id);
  sellerId = seller.id;
  const category = await db.category.create({ data: { nameEn: `Stock ${stamp}`, nameAr: `Stock ${stamp}`, slug: `stock-${stamp}` } });
  categoryId = category.id;
  const product = await db.product.create({ data: {
    sellerId: seller.id, categoryId: category.id, sku: `STOCK-${stamp}`, slug: `stock-product-${stamp}`,
    nameEn: "Stock race product", nameAr: "Stock race product", status: "ACTIVE", isB2CEnabled: true,
    prices: { create: { type: "B2C", currency: "AED", price: 100 } },
  } });
  created.products.push(product.id);
  productId = product.id;
  const warehouse = await db.warehouse.create({ data: {
    sellerId: seller.id, nameEn: `Stock Race Warehouse ${stamp}`, type: "SELLER", country: "AE", city: "Dubai",
  } });
  warehouseId = warehouse.id;
  const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: "MAIN" } });
  locationId = location.id;
  const stock = await db.inventoryStock.create({ data: { productId: product.id, locationId: location.id, qty: 10, reservedQty: 4 } });
  stockId = stock.id;
});

afterAll(async () => {
  await db.order.deleteMany({ where: { id: { in: created.orders } } });
  if (stockId) {
    await db.auditLog.deleteMany({ where: { entityType: "InventoryStock", entityId: stockId } });
    await db.inventoryStock.deleteMany({ where: { id: stockId } });
  }
  if (locationId) await db.inventoryLocation.deleteMany({ where: { id: locationId } });
  if (warehouseId) await db.warehouse.deleteMany({ where: { id: warehouseId } });
  await db.product.deleteMany({ where: { id: { in: created.products } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  await db.sellerProfile.deleteMany({ where: { id: { in: created.sellers } } });
  await db.user.deleteMany({ where: { id: { in: created.users } } });
});

async function raceAdjustmentAndCheckout(first: "adjustment" | "checkout") {
  await db.inventoryStock.update({ where: { id: stockId }, data: { qty: 10, reservedQty: 4 } });
  let releaseBlock!: () => void;
  let markLocked!: () => void;
  const release = new Promise<void>((resolve) => { releaseBlock = resolve; });
  const locked = new Promise<void>((resolve) => { markLocked = resolve; });
  const blocker = db.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`inventory-stock:${stockId}`}))`,
    );
    markLocked();
    await release;
  });
  await locked;

  const adjust = () => adjustInventory(stockId, 5, "ADJUSTMENT", created.users[1]!, `race-${first}`);
  const checkout = () => secureCreateOrder({
    userId: buyerId,
    type: "B2C",
    currency: "AED",
    items: [{ productId, quantity: 3 }],
    shippingAddress: { line1: "Race", city: "Dubai", country: "AE" },
    paymentMethod: "BANK_TRANSFER",
    idempotencyKey: `inventory-race-${first}-${stamp}`,
    requestFingerprint: `inventory-race-${first}-${stamp}`,
  });

  let adjustmentPromise: ReturnType<typeof adjust>;
  let checkoutPromise: ReturnType<typeof checkout>;
  if (first === "adjustment") {
    adjustmentPromise = adjust();
    await new Promise((resolve) => setTimeout(resolve, 25));
    checkoutPromise = checkout();
  } else {
    checkoutPromise = checkout();
    await new Promise((resolve) => setTimeout(resolve, 25));
    adjustmentPromise = adjust();
  }
  releaseBlock();
  await blocker;

  const [adjustment, order] = await Promise.allSettled([adjustmentPromise, checkoutPromise]);
  if (order.status === "fulfilled") created.orders.push(order.value.id);
  expect([adjustment, order].filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
  const stock = await db.inventoryStock.findUniqueOrThrow({ where: { id: stockId } });
  expect(stock.reservedQty).toBeLessThanOrEqual(stock.qty);
  if (adjustment.status === "fulfilled") expect(stock).toMatchObject({ qty: 5, reservedQty: 4 });
  if (order.status === "fulfilled") expect(stock).toMatchObject({ qty: 10, reservedQty: 7 });
}

describe("shared inventory adjustment and checkout lock", () => {
  it("preserves reserved <= on-hand when adjustment queues first", async () => {
    await raceAdjustmentAndCheckout("adjustment");
  });

  it("preserves reserved <= on-hand when checkout queues first", async () => {
    await raceAdjustmentAndCheckout("checkout");
  });
});
