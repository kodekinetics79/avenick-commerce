import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { advanceSellerOrderItems } from "../services/seller-fulfillment";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const created = { users: [] as string[], sellers: [] as string[], products: [] as string[] };
let categoryId = "";
let orderId = "";
let sellerAId = "";
let sellerBId = "";
let sellerAStaffId = "";
let sellerBProductId = "";

beforeAll(async () => {
  const [buyer, ownerA, staffA, ownerB] = await Promise.all([
    db.user.create({ data: { email: `journey-buyer-${stamp}@example.test`, firstName: "Buyer", lastName: "Journey", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `journey-owner-a-${stamp}@example.test`, firstName: "Owner", lastName: "A", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `journey-staff-a-${stamp}@example.test`, firstName: "Staff", lastName: "A", role: "SELLER_STAFF", status: "ACTIVE" } }),
    db.user.create({ data: { email: `journey-owner-b-${stamp}@example.test`, firstName: "Owner", lastName: "B", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  created.users.push(buyer.id, ownerA.id, staffA.id, ownerB.id);
  sellerAStaffId = staffA.id;

  const [sellerA, sellerB] = await Promise.all([
    db.sellerProfile.create({ data: { userId: ownerA.id, businessNameEn: `Journey Seller A ${stamp}`, crNumber: `JOURNEY-A-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
    db.sellerProfile.create({ data: { userId: ownerB.id, businessNameEn: `Journey Seller B ${stamp}`, crNumber: `JOURNEY-B-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
  ]);
  created.sellers.push(sellerA.id, sellerB.id);
  sellerAId = sellerA.id;
  sellerBId = sellerB.id;
  await db.sellerMembership.create({
    data: { sellerId: sellerA.id, userId: staffA.id, title: "Catalog specialist", permissions: ["catalog.manage", "orders.fulfill"], isActive: true },
  });

  const category = await db.category.create({ data: { nameEn: `Journey ${stamp}`, nameAr: `Journey ${stamp}`, slug: `journey-${stamp}` } });
  categoryId = category.id;
  const [productA, productB] = await Promise.all([
    db.product.create({ data: { sellerId: sellerA.id, categoryId, sku: `JOURNEY-A-${stamp}`, slug: `journey-a-${stamp}`, nameEn: "Seller A product", nameAr: "Seller A product", status: "ACTIVE" } }),
    db.product.create({ data: { sellerId: sellerB.id, categoryId, sku: `JOURNEY-B-${stamp}`, slug: `journey-b-${stamp}`, nameEn: "Seller B product", nameAr: "Seller B product", status: "ACTIVE" } }),
  ]);
  created.products.push(productA.id, productB.id);
  sellerBProductId = productB.id;

  const order = await db.order.create({
    data: {
      orderNumber: `JOURNEY-${stamp}`,
      userId: buyer.id,
      type: "B2C",
      status: "CONFIRMED",
      currency: "AED",
      subtotal: 300,
      vatAmount: 15,
      total: 315,
      shippingAddress: { line1: "Test", city: "Dubai", country: "AE" },
      items: { create: [
        { productId: productA.id, sellerId: sellerA.id, sku: productA.sku, nameEn: productA.nameEn, nameAr: productA.nameAr, quantity: 1, unitPrice: 100, vatAmount: 5, total: 105, status: "CONFIRMED" },
        { productId: productB.id, sellerId: sellerB.id, sku: productB.sku, nameEn: productB.nameEn, nameAr: productB.nameAr, quantity: 1, unitPrice: 200, vatAmount: 10, total: 210, status: "CONFIRMED" },
      ] },
    },
  });
  orderId = order.id;
});

afterAll(async () => {
  if (orderId) await db.order.deleteMany({ where: { id: orderId } });
  await db.auditLog.deleteMany({ where: { actorId: { in: created.users } } });
  await db.product.deleteMany({ where: { id: { in: created.products } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  await db.sellerProfile.deleteMany({ where: { id: { in: created.sellers } } });
  await db.user.deleteMany({ where: { id: { in: created.users } } });
});

describe("representative two-seller actor journey", () => {
  it("fixtures owner/staff capabilities distinctly for Seller A and owner-only Seller B", async () => {
    const membership = await db.sellerMembership.findUnique({ where: { userId: sellerAStaffId } });
    expect(membership).toMatchObject({ sellerId: sellerAId, isActive: true });
    expect(membership?.permissions).toEqual(["catalog.manage", "orders.fulfill"]);
    expect(await db.sellerMembership.count({ where: { sellerId: sellerBId } })).toBe(0);
  });

  it("attributes Seller A staff fulfillment and cannot alter Seller B's line", async () => {
    await advanceSellerOrderItems({ orderId, sellerId: sellerAId, status: "PROCESSING", actorId: sellerAStaffId });
    const lines = await db.orderItem.findMany({ where: { orderId }, select: { productId: true, status: true, sellerId: true } });
    expect(lines.find((line) => line.sellerId === sellerAId)?.status).toBe("PROCESSING");
    expect(lines.find((line) => line.productId === sellerBProductId)?.status).toBe("CONFIRMED");

    const audit = await db.auditLog.findFirst({
      where: { actorId: sellerAStaffId, sellerId: sellerAId, entityType: "OrderSellerFulfillment", entityId: orderId },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.after).toMatchObject({ sellerId: sellerAId, lineStatus: "PROCESSING" });
  });
});
