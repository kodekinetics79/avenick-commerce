import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { getSellerDashboard } from "../services/products";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const users: string[] = [], sellers: string[] = [], products: string[] = [];
let categoryId = "", orderId = "", sellerAId = "", sellerBId = "";

beforeAll(async () => {
  const [buyer, ownerA, ownerB] = await Promise.all([
    db.user.create({ data: { email: `dash-buyer-${stamp}@example.test`, firstName: "Dash", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `dash-a-${stamp}@example.test`, firstName: "Dash", lastName: "A", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `dash-b-${stamp}@example.test`, firstName: "Dash", lastName: "B", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  users.push(buyer.id, ownerA.id, ownerB.id);
  const [sellerA, sellerB] = await Promise.all([
    db.sellerProfile.create({ data: { userId: ownerA.id, businessNameEn: `Dash A ${stamp}`, crNumber: `DA-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
    db.sellerProfile.create({ data: { userId: ownerB.id, businessNameEn: `Dash B ${stamp}`, crNumber: `DB-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
  ]);
  sellers.push(sellerA.id, sellerB.id); sellerAId = sellerA.id; sellerBId = sellerB.id;
  const category = await db.category.create({ data: { nameEn: `Dash ${stamp}`, nameAr: "Dash", slug: `dash-${stamp}` } });
  categoryId = category.id;
  const [productA, productB] = await Promise.all([
    db.product.create({ data: { sellerId: sellerA.id, categoryId, sku: `DA-${stamp}`, slug: `da-${stamp}`, nameEn: "A", nameAr: "A", status: "ACTIVE" } }),
    db.product.create({ data: { sellerId: sellerB.id, categoryId, sku: `DB-${stamp}`, slug: `db-${stamp}`, nameEn: "B", nameAr: "B", status: "ACTIVE" } }),
  ]);
  products.push(productA.id, productB.id);
  const order = await db.order.create({ data: {
    orderNumber: `DASH-${stamp}`, userId: buyer.id, type: "B2C", status: "CONFIRMED", currency: "AED",
    subtotal: 300, vatAmount: 15, total: 315, shippingAddress: { city: "Dubai" },
    items: { create: [
      { productId: productA.id, sellerId: sellerA.id, sku: productA.sku, nameEn: "A", nameAr: "A", quantity: 1, unitPrice: 100, vatAmount: 5, total: 105 },
      { productId: productB.id, sellerId: sellerB.id, sku: productB.sku, nameEn: "B", nameAr: "B", quantity: 1, unitPrice: 200, vatAmount: 10, total: 210 },
    ] },
  } });
  orderId = order.id;
});

afterAll(async () => {
  if (orderId) await db.order.deleteMany({ where: { id: orderId } });
  await db.product.deleteMany({ where: { id: { in: products } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  await db.sellerProfile.deleteMany({ where: { id: { in: sellers } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
});

describe("seller dashboard multi-seller projection", () => {
  it("returns only each seller's own commercial value", async () => {
    const [a, b] = await Promise.all([getSellerDashboard(sellerAId), getSellerDashboard(sellerBId)]);
    expect(a.recentOrders.find((order) => order.id === orderId)?.total).toBe(105);
    expect(b.recentOrders.find((order) => order.id === orderId)?.total).toBe(210);
  });
});
