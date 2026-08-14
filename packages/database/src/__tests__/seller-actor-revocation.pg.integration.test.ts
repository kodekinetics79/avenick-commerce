import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { rejectSeller, setUserStatus } from "../services/admin";
import { submitQuote } from "../services/rfq";
import { advanceSellerOrderItems } from "../services/seller-fulfillment";

const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
let staffId = "", ownerId = "", adminId = "", buyerId = "", sellerId = "", productId = "", categoryId = "", orderId = "";
const rfqIds: string[] = [];

beforeAll(async () => {
  const [staff, owner, admin, buyer] = await Promise.all([
    db.user.create({ data: { email: `seller-revoke-staff-${stamp}@test.invalid`, firstName: "Seller", lastName: "Staff", role: "SELLER_STAFF", status: "ACTIVE" } }),
    db.user.create({ data: { email: `seller-revoke-owner-${stamp}@test.invalid`, firstName: "Seller", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `seller-revoke-admin-${stamp}@test.invalid`, firstName: "Platform", lastName: "Admin", role: "SUPER_ADMIN", status: "ACTIVE" } }),
    db.user.create({ data: { email: `seller-revoke-buyer-${stamp}@test.invalid`, firstName: "Buyer", lastName: "Test", role: "CONSUMER", status: "ACTIVE" } }),
  ]);
  [staffId, ownerId, adminId, buyerId] = [staff.id, owner.id, admin.id, buyer.id];
  const seller = await db.sellerProfile.create({ data: { userId: owner.id, businessNameEn: `Seller revoke ${stamp}`, crNumber: `SR-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } });
  sellerId = seller.id;
  await db.sellerMembership.create({ data: { userId: staff.id, sellerId, isActive: true, permissions: ["orders.fulfill", "quotes.submit"] } });
  const category = await db.category.create({ data: { nameEn: stamp, nameAr: stamp, slug: `seller-revoke-${stamp}` } });
  categoryId = category.id;
  const product = await db.product.create({ data: { sellerId, categoryId, sku: `SR-${stamp}`, slug: `sr-${stamp}`, nameEn: "Seller revoke", nameAr: "Seller revoke", status: "ACTIVE" } });
  productId = product.id;
  const order = await db.order.create({ data: { orderNumber: `SR-${stamp}`, userId: buyer.id, type: "B2C", status: "CONFIRMED", currency: "AED", subtotal: 100, vatAmount: 5, total: 105, shippingAddress: {}, items: { create: { productId, sellerId, sku: product.sku, nameEn: product.nameEn, nameAr: product.nameAr, quantity: 1, unitPrice: 100, vatAmount: 5, total: 105, status: "CONFIRMED" } } } });
  orderId = order.id;
});

async function openRfq(label: string) {
  const rfq = await db.rFQRequest.create({ data: { rfqNumber: `SR-${label}-${stamp}`, buyerId, status: "SUBMITTED", currency: "AED", items: { create: { nameEn: "Item", quantity: 1 } } }, include: { items: true } });
  rfqIds.push(rfq.id);
  return rfq;
}

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: { in: [staffId, ownerId, adminId] } } });
  await db.order.deleteMany({ where: { id: orderId } });
  await db.rFQRequest.deleteMany({ where: { id: { in: rfqIds } } });
  await db.product.deleteMany({ where: { id: productId } });
  await db.category.deleteMany({ where: { id: categoryId } });
  await db.sellerProfile.deleteMany({ where: { id: sellerId } });
  await db.user.deleteMany({ where: { id: { in: [staffId, ownerId, adminId, buyerId] } } });
});

run("seller actor revocation serialization", () => {
  it("rejects fulfillment after suspension wins", async () => {
    await setUserStatus({ userId: staffId, status: "SUSPENDED", actorId: adminId, actorRole: "SUPER_ADMIN" });
    await expect(advanceSellerOrderItems({ orderId, sellerId, status: "PROCESSING", actorId: staffId })).rejects.toThrow(/current seller authority/i);
    await db.user.update({ where: { id: staffId }, data: { status: "ACTIVE" } });
  });

  it("lets earlier fulfillment commit before suspension", async () => {
    let release!: () => void; const held = new Promise<void>((r) => { release = r; });
    let locked!: () => void; const signal = new Promise<void>((r) => { locked = r; });
    const fulfillment = advanceSellerOrderItems({ orderId, sellerId, status: "PROCESSING", actorId: staffId, afterActorLock: async () => { locked(); await held; } });
    await signal;
    const suspension = setUserStatus({ userId: staffId, status: "SUSPENDED", actorId: adminId, actorRole: "SUPER_ADMIN" });
    release();
    await expect(fulfillment).resolves.toBeTruthy();
    await expect(suspension).resolves.toMatchObject({ status: "SUSPENDED" });
    await db.user.update({ where: { id: staffId }, data: { status: "ACTIVE" } });
  });

  it("rejects a quote after seller rejection wins", async () => {
    const rfq = await openRfq("reject-first");
    await rejectSeller(sellerId, adminId, "revoked");
    await expect(submitQuote({ rfqId: rfq.id, sellerId, actorId: staffId, items: [{ itemId: rfq.items[0]!.id, unitQuoted: 10 }] })).rejects.toThrow(/current seller permission/i);
    await db.sellerProfile.update({ where: { id: sellerId }, data: { status: "ACTIVE" } });
  });

  it("lets an earlier quote commit before seller rejection", async () => {
    const rfq = await openRfq("quote-first");
    let release!: () => void; const held = new Promise<void>((r) => { release = r; });
    let locked!: () => void; const signal = new Promise<void>((r) => { locked = r; });
    const quote = submitQuote({ rfqId: rfq.id, sellerId, actorId: staffId, items: [{ itemId: rfq.items[0]!.id, unitQuoted: 10 }], afterActorLock: async () => { locked(); await held; } });
    await signal;
    const rejection = rejectSeller(sellerId, adminId, "revoked");
    release();
    await expect(quote).resolves.toMatchObject({ sellerId, status: "QUOTED" });
    await expect(rejection).resolves.toMatchObject({ status: "REJECTED" });
  });
});
