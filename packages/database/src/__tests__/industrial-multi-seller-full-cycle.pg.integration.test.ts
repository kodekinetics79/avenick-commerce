import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { finalizeInternalOrderPayment } from "../services/payments";
import { secureCreateOrder } from "../services/secure-checkout";
import { advanceSellerOrderItems } from "../services/seller-fulfillment";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const ids = {
  users: [] as string[], sellers: [] as string[], products: [] as string[],
  warehouses: [] as string[], locations: [] as string[], stocks: [] as string[], orders: [] as string[],
};
let categoryId = "";
let buyerId = "";
const sellerIds: string[] = [];
const actorIds: string[] = [];
const productIds: string[] = [];
const stockBefore = new Map<string, { qty: number; reservedQty: number }>();

beforeAll(async () => {
  const buyer = await db.user.create({ data: { email: `industrial-cycle-buyer-${stamp}@example.test`, firstName: "Cycle", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" } });
  buyerId = buyer.id;
  ids.users.push(buyer.id);
  const category = await db.category.create({ data: { nameEn: `Industrial Cycle ${stamp}`, nameAr: `Industrial Cycle ${stamp}`, slug: `industrial-cycle-${stamp}` } });
  categoryId = category.id;

  for (let index = 0; index < 3; index += 1) {
    const label = String.fromCharCode(65 + index);
    const owner = await db.user.create({ data: { email: `industrial-cycle-owner-${label}-${stamp}@example.test`, firstName: `Seller ${label}`, lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } });
    ids.users.push(owner.id);
    actorIds.push(owner.id);
    const seller = await db.sellerProfile.create({ data: { userId: owner.id, businessNameEn: `Industrial Cycle Seller ${label} ${stamp}`, crNumber: `IND-CYCLE-${label}-${stamp}`, type: "DISTRIBUTOR", country: "SA", city: "Riyadh", status: "ACTIVE" } });
    ids.sellers.push(seller.id);
    sellerIds.push(seller.id);
    const product = await db.product.create({
      data: {
        sellerId: seller.id, categoryId, sku: `IND-CYCLE-${label}-${stamp}`, slug: `industrial-cycle-${label.toLowerCase()}-${stamp}`,
        nameEn: `Industrial product ${label}`, nameAr: `Industrial product ${label}`, status: "ACTIVE",
        isPubliclyDiscoverable: true, isB2CEnabled: true, isB2BEnabled: true,
        prices: { create: { type: "B2C", currency: "SAR", minQty: 1, price: 100 + index * 25, vatRate: 15 } },
      },
    });
    ids.products.push(product.id);
    productIds.push(product.id);
    const warehouse = await db.warehouse.create({ data: { sellerId: seller.id, nameEn: `Industrial Cycle Warehouse ${label}`, type: "SELLER", country: "SA", city: "Riyadh" } });
    ids.warehouses.push(warehouse.id);
    const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: `CYCLE-${label}` } });
    ids.locations.push(location.id);
    const stock = await db.inventoryStock.create({ data: { productId: product.id, locationId: location.id, qty: 40 + index, reservedQty: 0, reorderPoint: 5 } });
    ids.stocks.push(stock.id);
    stockBefore.set(product.id, { qty: stock.qty, reservedQty: stock.reservedQty });
  }
});

afterAll(async () => {
  const items = ids.orders.length ? await db.orderItem.findMany({ where: { orderId: { in: ids.orders } }, select: { id: true } }) : [];
  await db.orderLinePriceTrace.deleteMany({ where: { orderItemId: { in: items.map(({ id }) => id) } } });
  await db.commission.deleteMany({ where: { orderId: { in: ids.orders } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: ids.users } } });
  await db.order.deleteMany({ where: { id: { in: ids.orders } } });
  await db.commercialPriceSnapshot.deleteMany({ where: { productId: { in: ids.products } } });
  await db.inventoryMovement.deleteMany({ where: { stockId: { in: ids.stocks } } });
  await db.inventoryStock.deleteMany({ where: { id: { in: ids.stocks } } });
  await db.inventoryLocation.deleteMany({ where: { id: { in: ids.locations } } });
  await db.warehouse.deleteMany({ where: { id: { in: ids.warehouses } } });
  await db.product.deleteMany({ where: { id: { in: ids.products } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  await db.sellerProfile.deleteMany({ where: { id: { in: ids.sellers } } });
  await db.user.deleteMany({ where: { id: { in: ids.users } } });
});

describe("industrial multi-seller full sale cycle", () => {
  it("creates multiple fresh sandbox orders and advances every seller through delivery without crossing scopes", async () => {
    const baskets = [
      [{ productId: productIds[0]!, quantity: 2 }],
      [{ productId: productIds[1]!, quantity: 1 }],
      [{ productId: productIds[2]!, quantity: 3 }],
      productIds.map((productId) => ({ productId, quantity: 2 })),
    ];
    const expectedSold = new Map(productIds.map((productId) => [productId, 0]));

    for (const [index, items] of baskets.entries()) {
      const order = await secureCreateOrder({
        userId: buyerId,
        type: "B2C",
        currency: "SAR",
        items,
        shippingAddress: { label: "Certification sandbox", line1: "Industrial Simulation 1", city: "Riyadh", country: "SA" },
        paymentMethod: "MOCK",
        notes: "CERTIFICATION SANDBOX — no production payment",
        idempotencyKey: `industrial-cycle-${stamp}-${index}`,
      });
      ids.orders.push(order.id);
      await finalizeInternalOrderPayment({ orderId: order.id, method: "MOCK", pilotMockAllowed: true, actorId: buyerId });
      for (const item of items) expectedSold.set(item.productId, expectedSold.get(item.productId)! + item.quantity);

      const participatingSellers = [...new Set(order.items.map((item) => item.sellerId))];
      for (const status of ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const) {
        for (const sellerId of participatingSellers) {
          const sellerIndex = sellerIds.indexOf(sellerId);
          const before = await db.orderItem.findMany({ where: { orderId: order.id, sellerId: { not: sellerId } }, select: { id: true, status: true }, orderBy: { id: "asc" } });
          await advanceSellerOrderItems({ orderId: order.id, sellerId, status, actorId: actorIds[sellerIndex]! });
          const scoped = await db.orderItem.findMany({ where: { orderId: order.id }, select: { sellerId: true, status: true } });
          expect(scoped.filter((line) => line.sellerId === sellerId).every((line) => line.status === status)).toBe(true);
          const after = await db.orderItem.findMany({ where: { orderId: order.id, sellerId: { not: sellerId } }, select: { id: true, status: true }, orderBy: { id: "asc" } });
          expect(after).toEqual(before);
        }
      }
      const completed = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true, commissions: true, items: true } });
      expect(completed).toMatchObject({ status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "MOCK", currency: "SAR" });
      expect(completed.payments).toHaveLength(1);
      expect(completed.payments[0]).toMatchObject({ method: "MOCK", status: "PAID" });
      expect(completed.commissions).toHaveLength(participatingSellers.length);
      expect(completed.items.every((item) => item.status === "DELIVERED")).toBe(true);
    }

    for (const productId of productIds) {
      const stock = await db.inventoryStock.findFirstOrThrow({ where: { productId, variantId: null } });
      expect(stock.reservedQty).toBe(0);
      expect(stock.qty).toBe(stockBefore.get(productId)!.qty - expectedSold.get(productId)!);
      const movements = await db.inventoryMovement.aggregate({ where: { stockId: stock.id, type: "OUT" }, _sum: { qty: true } });
      expect(movements._sum.qty).toBe(expectedSold.get(productId));
    }
    expect(await db.auditLog.count({ where: { entityType: "OrderSellerFulfillment", entityId: { in: ids.orders } } })).toBe(24);
  }, 60_000);
});
