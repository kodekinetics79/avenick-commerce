import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@avenick/database";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth-instance", () => ({ auth: authMock }));

import { GET as getSellerOrders } from "@/app/api/seller/orders/route";
import { importProductsCsv } from "@/app/products/actions";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const created = { users: [] as string[], sellers: [] as string[], products: [] as string[] };
let categoryId = "";
let orderId = "";
let fulfillmentStaffId = "";
let catalogStaffId = "";
let sellerAOwnerId = "";
let sellerBOwnerId = "";
let sellerAId = "";
let sellerBId = "";
let productASku = "";
let stockId = "";
let locationId = "";
let warehouseId = "";

function sessionFor(userId: string) {
  authMock.mockResolvedValue({ user: { id: userId } });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const [buyer, ownerA, staffFulfillment, staffCatalog, ownerB] = await Promise.all([
    db.user.create({ data: { email: `api-buyer-${stamp}@example.test`, firstName: "API", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `api-seller-a-owner-${stamp}@example.test`, firstName: "Seller A", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `api-seller-a-fulfillment-${stamp}@example.test`, firstName: "Seller A", lastName: "Fulfillment", role: "SELLER_STAFF", status: "ACTIVE" } }),
    db.user.create({ data: { email: `api-seller-a-catalog-${stamp}@example.test`, firstName: "Seller A", lastName: "Catalog", role: "SELLER_STAFF", status: "ACTIVE" } }),
    db.user.create({ data: { email: `api-seller-b-owner-${stamp}@example.test`, firstName: "Seller B", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  created.users.push(buyer.id, ownerA.id, staffFulfillment.id, staffCatalog.id, ownerB.id);
  fulfillmentStaffId = staffFulfillment.id;
  catalogStaffId = staffCatalog.id;
  sellerAOwnerId = ownerA.id;
  sellerBOwnerId = ownerB.id;

  const [sellerA, sellerB] = await Promise.all([
    db.sellerProfile.create({ data: { userId: ownerA.id, businessNameEn: `API Seller A ${stamp}`, crNumber: `API-A-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
    db.sellerProfile.create({ data: { userId: ownerB.id, businessNameEn: `API Seller B ${stamp}`, crNumber: `API-B-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
  ]);
  created.sellers.push(sellerA.id, sellerB.id);
  sellerAId = sellerA.id;
  sellerBId = sellerB.id;
  await Promise.all([
    db.sellerMembership.create({ data: { userId: staffFulfillment.id, sellerId: sellerA.id, title: "Fulfillment specialist", permissions: ["orders.view", "orders.fulfill"], isActive: true } }),
    db.sellerMembership.create({ data: { userId: staffCatalog.id, sellerId: sellerA.id, title: "Catalog specialist", permissions: ["catalog.view", "catalog.manage"], isActive: true } }),
  ]);

  const category = await db.category.create({ data: { nameEn: `API ${stamp}`, nameAr: `API ${stamp}`, slug: `api-${stamp}` } });
  categoryId = category.id;
  const [productA, productB] = await Promise.all([
    db.product.create({ data: { sellerId: sellerA.id, categoryId, sku: `API-A-${stamp}`, slug: `api-a-${stamp}`, nameEn: "Seller A line", nameAr: "Seller A line", status: "ACTIVE" } }),
    db.product.create({ data: { sellerId: sellerB.id, categoryId, sku: `API-B-${stamp}`, slug: `api-b-${stamp}`, nameEn: "Seller B line", nameAr: "Seller B line", status: "ACTIVE" } }),
  ]);
  created.products.push(productA.id, productB.id);
  productASku = productA.sku;
  const warehouse = await db.warehouse.create({ data: {
    sellerId: sellerA.id, nameEn: `API Warehouse ${stamp}`, type: "SELLER", country: "AE", city: "Dubai",
  } });
  warehouseId = warehouse.id;
  const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: "MAIN" } });
  locationId = location.id;
  const stock = await db.inventoryStock.create({ data: {
    productId: productA.id, locationId: location.id, qty: 10, reservedQty: 4,
  } });
  stockId = stock.id;
  const order = await db.order.create({ data: {
    orderNumber: `API-JOURNEY-${stamp}`, userId: buyer.id, type: "B2C", status: "CONFIRMED", currency: "AED",
    subtotal: 300, vatAmount: 15, total: 315, shippingAddress: { line1: "Test", city: "Dubai", country: "AE" },
    items: { create: [
      { productId: productA.id, sellerId: sellerA.id, sku: productA.sku, nameEn: productA.nameEn, nameAr: productA.nameAr, quantity: 1, unitPrice: 100, vatAmount: 5, total: 105, status: "CONFIRMED" },
      { productId: productB.id, sellerId: sellerB.id, sku: productB.sku, nameEn: productB.nameEn, nameAr: productB.nameAr, quantity: 1, unitPrice: 200, vatAmount: 10, total: 210, status: "CONFIRMED" },
    ] },
  } });
  orderId = order.id;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  if (orderId) await db.order.deleteMany({ where: { id: orderId } });
  if (stockId) await db.inventoryStock.deleteMany({ where: { id: stockId } });
  if (locationId) await db.inventoryLocation.deleteMany({ where: { id: locationId } });
  if (warehouseId) await db.warehouse.deleteMany({ where: { id: warehouseId } });
  await db.product.deleteMany({ where: { id: { in: created.products } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  await db.sellerProfile.deleteMany({ where: { id: { in: created.sellers } } });
  await db.user.deleteMany({ where: { id: { in: created.users } } });
});

describe.skipIf(!process.env.DATABASE_URL)("seeded-role marketplace API journey", () => {
  it("projects only Seller A lines to its fulfillment staff", async () => {
    sessionFor(fulfillmentStaffId);
    const response = await getSellerOrders(new NextRequest("http://seller.test/api/seller/orders"));
    expect(response.status).toBe(200);
    const body = await response.json();
    const order = body.orders.find((candidate: { id: string }) => candidate.id === orderId);
    expect(order).toMatchObject({ total: 105 });
    expect(order.items).toHaveLength(1);
    expect(order.items[0].sellerId).toBe(sellerAId);
    expect(JSON.stringify(order)).not.toContain(sellerBId);
  });

  it("denies the catalog-limited Seller A staff from the orders API", async () => {
    sessionFor(catalogStaffId);
    const response = await getSellerOrders(new NextRequest("http://seller.test/api/seller/orders"));
    expect(response.status).toBe(403);
  });

  it("denies catalog staff inventory fields and preserves the reservation floor for owners", async () => {
    sessionFor(catalogStaffId);
    await expect(importProductsCsv([{ sku: productASku, stock: "9" }]))
      .rejects.toThrow(/inventory\.manage/);

    sessionFor(sellerAOwnerId);
    const result = await importProductsCsv([{ sku: productASku, stock: "3" }]);
    expect(result).toMatchObject({ updated: 0, skipped: 1 });
    expect(result.errors[0]).toMatch(/below reserved quantity/);
    expect(await db.inventoryStock.findUnique({ where: { id: stockId } }))
      .toMatchObject({ qty: 10, reservedQty: 4 });
  });

  it("fails closed when a CSV price cannot identify one active tier", async () => {
    const product = await db.product.findUniqueOrThrow({ where: { sku: productASku } });
    const prices = await Promise.all([
      db.productPrice.create({ data: {
        productId: product.id, type: "B2C", currency: "AED", minQty: 1, maxQty: 9, price: 100,
      } }),
      db.productPrice.create({ data: {
        productId: product.id, type: "B2B", currency: "AED", minQty: 10, price: 80,
      } }),
    ]);

    try {
      sessionFor(sellerAOwnerId);
      const result = await importProductsCsv([{ sku: productASku, price: "1" }]);
      expect(result).toMatchObject({ updated: 0, skipped: 1 });
      expect(result.errors[0]).toMatch(/price import is ambiguous/i);

      const unchanged = await db.productPrice.findMany({
        where: { id: { in: prices.map((price) => price.id) } },
        orderBy: { minQty: "asc" },
      });
      expect(unchanged.map((price) => Number(price.price))).toEqual([100, 80]);
    } finally {
      await db.productPrice.deleteMany({ where: { id: { in: prices.map((price) => price.id) } } });
    }
  });

  it("fails closed when CSV stock spans location or variant identities", async () => {
    const product = await db.product.findUniqueOrThrow({ where: { sku: productASku } });
    const variant = await db.productVariant.create({ data: {
      productId: product.id,
      sku: `${productASku}-VARIANT`,
      nameEn: "Ambiguous variant",
      attributes: { size: "test" },
    } });
    const warehouse = await db.warehouse.create({ data: {
      sellerId: sellerAId,
      nameEn: `API Secondary Warehouse ${stamp}`,
      type: "SELLER",
      country: "AE",
      city: "Dubai",
    } });
    const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: "SECONDARY" } });
    const secondStock = await db.inventoryStock.create({ data: {
      productId: product.id,
      variantId: variant.id,
      locationId: location.id,
      qty: 25,
      reservedQty: 2,
    } });

    try {
      sessionFor(sellerAOwnerId);
      const result = await importProductsCsv([{ sku: productASku, stock: "99" }]);
      expect(result).toMatchObject({ updated: 0, skipped: 1 });
      expect(result.errors[0]).toMatch(/stock import is ambiguous/i);

      const unchanged = await db.inventoryStock.findMany({
        where: { id: { in: [stockId, secondStock.id] } },
        orderBy: { qty: "asc" },
      });
      expect(unchanged.map((stock) => stock.qty)).toEqual([10, 25]);
    } finally {
      await db.inventoryStock.deleteMany({ where: { id: secondStock.id } });
      await db.inventoryLocation.deleteMany({ where: { id: location.id } });
      await db.warehouse.deleteMany({ where: { id: warehouse.id } });
      await db.productVariant.deleteMany({ where: { id: variant.id } });
    }
  });

  it("projects only Seller B lines to the Seller B owner", async () => {
    sessionFor(sellerBOwnerId);
    const response = await getSellerOrders(new NextRequest("http://seller.test/api/seller/orders"));
    expect(response.status).toBe(200);
    const body = await response.json();
    const order = body.orders.find((candidate: { id: string }) => candidate.id === orderId);
    expect(order).toMatchObject({ total: 210 });
    expect(order.items).toHaveLength(1);
    expect(order.items[0].sellerId).toBe(sellerBId);
    expect(JSON.stringify(order)).not.toContain(sellerAId);
  });

  it("revokes API access immediately when fulfillment membership is removed", async () => {
    await db.sellerMembership.update({ where: { userId: fulfillmentStaffId }, data: { isActive: false } });
    sessionFor(fulfillmentStaffId);
    const response = await getSellerOrders(new NextRequest("http://seller.test/api/seller/orders"));
    expect(response.status).toBe(401);
  });
});
