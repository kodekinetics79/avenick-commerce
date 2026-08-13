import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { createCustomerReturnRequests } from "../services/customer-returns";
import { getSellerOrderProjections } from "../services/seller-order-projections";
import { setReturnStatus } from "../services/workflow";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const ids = { users: [] as string[], sellers: [] as string[], products: [] as string[] };
let categoryId = "", orderId = "", buyerId = "", ownerAId = "", sellerAId = "", sellerBId = "";
let itemAId = "", itemBId = "";

beforeAll(async () => {
  const [buyer, ownerA, ownerB] = await Promise.all([
    db.user.create({ data: { email: `closure-buyer-${stamp}@example.test`, firstName: "Buyer", lastName: "Closure", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `closure-a-${stamp}@example.test`, firstName: "Owner", lastName: "A", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `closure-b-${stamp}@example.test`, firstName: "Owner", lastName: "B", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  ids.users.push(buyer.id, ownerA.id, ownerB.id); buyerId = buyer.id; ownerAId = ownerA.id;
  const [sellerA, sellerB] = await Promise.all([
    db.sellerProfile.create({ data: { userId: ownerA.id, businessNameEn: `Closure A ${stamp}`, crNumber: `CA-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
    db.sellerProfile.create({ data: { userId: ownerB.id, businessNameEn: `Closure B ${stamp}`, crNumber: `CB-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
  ]);
  ids.sellers.push(sellerA.id, sellerB.id); sellerAId = sellerA.id; sellerBId = sellerB.id;
  const category = await db.category.create({ data: { nameEn: `Closure ${stamp}`, nameAr: `Closure ${stamp}`, slug: `closure-${stamp}` } });
  categoryId = category.id;
  const [productA, productB] = await Promise.all([
    db.product.create({ data: { sellerId: sellerA.id, categoryId, sku: `CA-${stamp}`, slug: `ca-${stamp}`, nameEn: "A line", nameAr: "A line", status: "ACTIVE" } }),
    db.product.create({ data: { sellerId: sellerB.id, categoryId, sku: `CB-${stamp}`, slug: `cb-${stamp}`, nameEn: "B line", nameAr: "B line", status: "ACTIVE" } }),
  ]);
  ids.products.push(productA.id, productB.id);
  const order = await db.order.create({ data: {
    orderNumber: `CLOSURE-${stamp}`, userId: buyer.id, type: "B2C", status: "DELIVERED", currency: "AED",
    subtotal: 300, vatAmount: 15, total: 315, shippingAddress: { line1: "Test", city: "Dubai", country: "AE" },
    items: { create: [
      { productId: productA.id, sellerId: sellerA.id, sku: productA.sku, nameEn: productA.nameEn, nameAr: productA.nameAr, quantity: 2, unitPrice: 50, vatAmount: 5, total: 105, status: "DELIVERED" },
      { productId: productB.id, sellerId: sellerB.id, sku: productB.sku, nameEn: productB.nameEn, nameAr: productB.nameAr, quantity: 1, unitPrice: 200, vatAmount: 10, total: 210, status: "DELIVERED" },
    ] },
  }, include: { items: true } });
  orderId = order.id;
  itemAId = order.items.find((item) => item.sellerId === sellerA.id)!.id;
  itemBId = order.items.find((item) => item.sellerId === sellerB.id)!.id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: { in: ids.users } } });
  if (orderId) await db.order.deleteMany({ where: { id: orderId } });
  await db.product.deleteMany({ where: { id: { in: ids.products } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  await db.sellerProfile.deleteMany({ where: { id: { in: ids.sellers } } });
  await db.user.deleteMany({ where: { id: { in: ids.users } } });
});

describe("marketplace release isolation closure", () => {
  it("projects only the requesting seller's line values", async () => {
    const a = await getSellerOrderProjections(sellerAId, {});
    const b = await getSellerOrderProjections(sellerBId, {});
    expect(a.orders[0]).toMatchObject({ total: 105, subtotal: 100, vatAmount: 5 });
    expect(a.orders[0]?.items).toHaveLength(1);
    expect(b.orders[0]).toMatchObject({ total: 210, subtotal: 200, vatAmount: 10 });
    expect(b.orders[0]?.items).toHaveLength(1);
  });

  it("creates a return only for the selected line and quantity and enforces that ceiling", async () => {
    const requests = await createCustomerReturnRequests({
      userId: buyerId, orderId, reason: "one unit damaged", selections: [{ orderItemId: itemAId, quantity: 1 }],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ sellerId: sellerAId });
    expect(Number(requests[0]?.refundAmount)).toBe(52.5);
    expect(await db.returnRequest.count({ where: { orderId, sellerId: sellerBId } })).toBe(0);
    await setReturnStatus({ returnId: requests[0]!.id, status: "APPROVED", actorId: ownerAId });
    await expect(setReturnStatus({ returnId: requests[0]!.id, status: "REFUNDED", actorId: ownerAId, refundAmount: 53 }))
      .rejects.toThrow("selected return quantity");
    expect(itemBId).toBeTruthy();
  });
});
