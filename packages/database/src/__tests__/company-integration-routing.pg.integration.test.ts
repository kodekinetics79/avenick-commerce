import { afterEach, describe, expect, it } from "vitest";
import { db } from "../index";
import { secureCreateOrder } from "../services/secure-checkout";
import { setGovernedIntegrationConnectionStatus } from "../services/integration-routing";

const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const users: string[] = [];
const companies: string[] = [];
const connections: string[] = [];

async function fixture(label: string) {
  const stamp = `${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const [buyer, sellerOwner, admin] = await Promise.all([
    db.user.create({ data: { email: `${stamp}-buyer@test.invalid`, firstName: "Route", lastName: "Buyer", role: "COMPANY_BUYER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-seller@test.invalid`, firstName: "Route", lastName: "Seller", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-admin@test.invalid`, firstName: "Route", lastName: "Admin", role: "SUPER_ADMIN", status: "ACTIVE" } }),
  ]);
  users.push(buyer.id, sellerOwner.id, admin.id);
  const company = await db.company.create({ data: {
    nameEn: stamp, industry: "OTHER", size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE",
    members: { create: { userId: buyer.id, role: "COMPANY_BUYER", isActive: true } },
  } });
  companies.push(company.id);
  const seller = await db.sellerProfile.create({ data: {
    userId: sellerOwner.id, businessNameEn: stamp, crNumber: `ROUTE-${stamp}`,
    type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE",
  } });
  const category = await db.category.create({ data: { nameEn: stamp, nameAr: stamp, slug: `route-${stamp}` } });
  const product = await db.product.create({ data: {
    sellerId: seller.id, categoryId: category.id, sku: `ROUTE-${stamp}`, slug: `route-${stamp}`,
    nameEn: "Routed product", nameAr: "Routed product", status: "ACTIVE", isB2BEnabled: true,
    prices: { create: { type: "B2B", currency: "AED", price: 100, vatRate: 5 } },
  } });
  const warehouse = await db.warehouse.create({ data: { sellerId: seller.id, nameEn: stamp, type: "SELLER", country: "AE", city: "Dubai" } });
  const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: stamp } });
  await db.inventoryStock.create({ data: { productId: product.id, locationId: location.id, qty: 20 } });
  const [first, second] = await Promise.all([
    db.integrationConnection.create({ data: {
      tenantKey: "default", system: "ERP", connectionKey: `${stamp}-a`, name: `${stamp} A`, status: "ACTIVE",
      baseUrl: "https://erp-a.example.test", credentialsRef: "env:INTEGRATION_ERP_TOKEN",
    } }),
    db.integrationConnection.create({ data: {
      tenantKey: "default", system: "ERP", connectionKey: `${stamp}-b`, name: `${stamp} B`, status: "ACTIVE",
      baseUrl: "https://erp-b.example.test", credentialsRef: "env:INTEGRATION_ERP_TOKEN",
    } }),
  ]);
  connections.push(first.id, second.id);
  return { stamp, buyer, admin, company, seller, product, first, second };
}

async function place(f: Awaited<ReturnType<typeof fixture>>, suffix: string, afterIntegrationRoutingLocks?: () => Promise<void>) {
  const po = await db.purchaseOrder.create({ data: {
    poNumber: `ROUTE-${f.stamp}-${suffix}`,
    companyId: f.company.id,
    requesterId: f.buyer.id,
    status: "APPROVED",
    currency: "AED",
    total: 105,
  } });
  return secureCreateOrder({
    userId: f.buyer.id,
    type: "B2B",
    currency: "AED",
    items: [{ productId: f.product.id, quantity: 1 }],
    shippingAddress: { line1: "Test", city: "Dubai", country: "AE" },
    purchaseOrderId: po.id,
    idempotencyKey: `${f.stamp}:${suffix}`,
    governedCommercial: {
      total: 105,
      lines: [{
        productId: f.product.id, sellerId: f.seller.id, quantity: 1,
        unitPrice: 100, vatRate: 5, sku: f.product.sku, nameEn: f.product.nameEn,
      }],
    },
    afterIntegrationRoutingLocks,
  });
}

afterEach(async () => {
  const userIds = users.splice(0);
  const companyIds = companies.splice(0);
  const connectionIds = connections.splice(0);
  if (!userIds.length) return;
  await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await db.integrationOutbox.deleteMany({ where: { connectionId: { in: connectionIds } } });
  await db.order.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.purchaseOrder.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.integrationCompanyRoute.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.integrationConnection.deleteMany({ where: { id: { in: connectionIds } } });
  await db.companyMember.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  const sellers = await db.sellerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const sellerIds = sellers.map(({ id }) => id);
  await db.inventoryStock.deleteMany({ where: { product: { sellerId: { in: sellerIds } } } });
  await db.inventoryLocation.deleteMany({ where: { warehouse: { sellerId: { in: sellerIds } }, stock: { none: {} } } });
  await db.warehouse.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.product.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.category.deleteMany({ where: { slug: { startsWith: "route-" }, products: { none: {} } } });
  await db.sellerProfile.deleteMany({ where: { id: { in: sellerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

run("company ERP routing governance", () => {
  it("routes to the explicit company connection when two same-system connections are active", async () => {
    const f = await fixture("explicit");
    await db.integrationCompanyRoute.create({ data: { companyId: f.company.id, connectionId: f.first.id } });
    const order = await place(f, "mapped");
    await expect(db.integrationOutbox.findFirstOrThrow({ where: { aggregateId: order.id } }))
      .resolves.toMatchObject({ connectionId: f.first.id, destination: "ERP" });
  });

  it("fails closed when multiple outbound routes exist", async () => {
    const f = await fixture("ambiguous");
    await db.integrationCompanyRoute.createMany({ data: [
      { companyId: f.company.id, connectionId: f.first.id },
      { companyId: f.company.id, connectionId: f.second.id },
    ] });
    await expect(place(f, "ambiguous")).rejects.toThrow(/ambiguous/i);
  });

  it("fails closed when an ERP-linked company has no connection route", async () => {
    const f = await fixture("missing");
    await db.externalAccountLink.create({ data: {
      companyId: f.company.id, system: "ERP", externalCustomerId: `ERP-${f.company.id}`,
    } });
    await expect(place(f, "missing")).rejects.toThrow(/not configured/i);
  });

  it("lets an order holding the route fence commit and refuses to disable unresolved work", async () => {
    const f = await fixture("order-first");
    await db.integrationCompanyRoute.create({ data: { companyId: f.company.id, connectionId: f.first.id } });
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const signal = new Promise<void>((resolve) => { locked = resolve; });
    const order = place(f, "order-first", async () => { locked(); await held; });
    await signal;
    const disable = setGovernedIntegrationConnectionStatus({ id: f.first.id, status: "DISABLED", actorId: f.admin.id });
    release();
    const created = await order;
    await expect(disable).rejects.toThrow(/unresolved/i);
    await expect(db.integrationOutbox.findFirstOrThrow({ where: { aggregateId: created.id } })).resolves.toMatchObject({ connectionId: f.first.id });
    await expect(db.integrationConnection.findUniqueOrThrow({ where: { id: f.first.id } })).resolves.toMatchObject({ status: "ACTIVE" });
  });

  it("rejects order routing after disable wins", async () => {
    const f = await fixture("disable-first");
    await db.integrationCompanyRoute.create({ data: { companyId: f.company.id, connectionId: f.first.id } });
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const signal = new Promise<void>((resolve) => { locked = resolve; });
    const disable = setGovernedIntegrationConnectionStatus({
      id: f.first.id, status: "DISABLED", actorId: f.admin.id,
      afterGovernanceLocks: async () => { locked(); await held; },
    });
    await signal;
    const order = place(f, "disable-first");
    release();
    await expect(disable).resolves.toMatchObject({ status: "DISABLED" });
    await expect(order).rejects.toThrow(/unavailable|disconnected/i);
  });
});
