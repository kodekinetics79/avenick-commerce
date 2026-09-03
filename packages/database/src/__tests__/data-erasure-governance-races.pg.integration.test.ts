import { afterEach, describe, expect, it } from "vitest";
import { db } from "../index";
import { createGovernedApprovalPolicy } from "../services/b2b-purchase-orders";
import { eraseUserData } from "../services/data-rights";
import { lockInventoryStockRows } from "../services/checkout-invariants";
import { secureCreateOrder } from "../services/secure-checkout";

const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const userIds: string[] = [];
const companyIds: string[] = [];

async function fixture(label: string, companyActor = false) {
  const stamp = `${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const [subject, platformAdmin, sellerOwner] = await Promise.all([
    db.user.create({ data: {
      email: `${stamp}-subject@test.invalid`, firstName: "Erase", lastName: "Subject",
      role: companyActor ? "COMPANY_ADMIN" : "CONSUMER", status: "ACTIVE",
    } }),
    db.user.create({ data: {
      email: `${stamp}-platform@test.invalid`, firstName: "Erase", lastName: "Admin",
      role: "SUPER_ADMIN", status: "ACTIVE",
    } }),
    db.user.create({ data: {
      email: `${stamp}-seller@test.invalid`, firstName: "Erase", lastName: "Seller",
      role: "SELLER_OWNER", status: "ACTIVE",
    } }),
  ]);
  userIds.push(subject.id, platformAdmin.id, sellerOwner.id);
  const seller = await db.sellerProfile.create({ data: {
    userId: sellerOwner.id, businessNameEn: stamp, crNumber: `ERASE-${stamp}`,
    type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE",
  } });
  const category = await db.category.create({ data: { nameEn: stamp, nameAr: stamp, slug: `erase-race-${stamp}` } });
  const product = await db.product.create({ data: {
    sellerId: seller.id, categoryId: category.id, sku: `ERASE-${stamp}`, slug: `erase-${stamp}`,
    nameEn: "Erasure race product", nameAr: "Erasure race product", status: "ACTIVE",
    isB2CEnabled: true,
    prices: { create: { type: "B2C", currency: "AED", price: 25, vatRate: 5 } },
  } });
  const warehouse = await db.warehouse.create({ data: { sellerId: seller.id, nameEn: stamp, type: "SELLER", country: "AE", city: "Dubai" } });
  const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: stamp } });
  const stock = await db.inventoryStock.create({ data: { productId: product.id, locationId: location.id, qty: 10 } });
  let company: Awaited<ReturnType<typeof db.company.create>> | undefined;
  if (companyActor) {
    company = await db.company.create({ data: {
      nameEn: stamp, industry: "OTHER", size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE",
      members: { create: { userId: subject.id, role: "COMPANY_ADMIN", isActive: true } },
    } });
    companyIds.push(company.id);
  }
  return { subject, platformAdmin, seller, product, stock, company };
}

async function waitForUserFence(userId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [row] = await db.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${`user-commerce:${userId}`})) AS acquired
    `;
    if (row?.acquired === false) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for user commerce fence");
}

afterEach(async () => {
  const users = userIds.splice(0);
  const companies = companyIds.splice(0);
  if (!users.length) return;
  await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await db.order.deleteMany({ where: { userId: { in: users } } });
  await db.approvalPolicy.deleteMany({ where: { companyId: { in: companies } } });
  await db.purchaseOrder.deleteMany({ where: { companyId: { in: companies } } });
  await db.companyMember.deleteMany({ where: { companyId: { in: companies } } });
  await db.company.deleteMany({ where: { id: { in: companies } } });
  const sellers = await db.sellerProfile.findMany({ where: { userId: { in: users } }, select: { id: true } });
  const sellerIds = sellers.map(({ id }) => id);
  await db.inventoryStock.deleteMany({ where: { product: { sellerId: { in: sellerIds } } } });
  await db.inventoryLocation.deleteMany({ where: { warehouse: { sellerId: { in: sellerIds } }, stock: { none: {} } } });
  await db.warehouse.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.product.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.category.deleteMany({ where: { slug: { startsWith: "erase-race-" }, products: { none: {} } } });
  await db.sellerProfile.deleteMany({ where: { id: { in: sellerIds } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
});

run("data erasure governance serialization", () => {
  it("allows checkout already holding the user fence, then erases the subject", async () => {
    const f = await fixture("checkout-first");
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let inventoryLocked!: () => void;
    const signal = new Promise<void>((resolve) => { inventoryLocked = resolve; });
    const blocker = db.$transaction(async (tx) => {
      await lockInventoryStockRows(tx, [f.stock.id]);
      inventoryLocked();
      await held;
    });
    await signal;
    const checkout = secureCreateOrder({
      userId: f.subject.id, type: "B2C", currency: "AED",
      items: [{ productId: f.product.id, quantity: 1 }],
      shippingAddress: { line1: "Test", city: "Dubai", country: "AE" },
    });
    await waitForUserFence(f.subject.id);
    const erasure = eraseUserData(f.subject.id, f.platformAdmin.id);
    release();
    await blocker;
    await expect(checkout).resolves.toMatchObject({ userId: f.subject.id });
    await expect(erasure).resolves.toMatchObject({ anonymised: true });
    await expect(db.user.findUniqueOrThrow({ where: { id: f.subject.id } })).resolves.toMatchObject({ status: "SUSPENDED", deletedAt: expect.any(Date) });
  });

  it("rejects checkout after erasure wins the user fence", async () => {
    const f = await fixture("erase-before-checkout");
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const signal = new Promise<void>((resolve) => { locked = resolve; });
    const erasure = eraseUserData(f.subject.id, f.platformAdmin.id, { afterGovernanceLocks: async () => { locked(); await held; } });
    await signal;
    const checkout = secureCreateOrder({
      userId: f.subject.id, type: "B2C", currency: "AED",
      items: [{ productId: f.product.id, quantity: 1 }],
      shippingAddress: { line1: "Test", city: "Dubai", country: "AE" },
    });
    release();
    await expect(erasure).resolves.toMatchObject({ anonymised: true });
    await expect(checkout).rejects.toThrow(/not active/i);
  });

  it("serializes governed authority mutation before erasure", async () => {
    const f = await fixture("policy-first", true);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const signal = new Promise<void>((resolve) => { locked = resolve; });
    const policy = createGovernedApprovalPolicy({
      companyId: f.company!.id, actorId: f.subject.id, name: "Before erasure",
      thresholdAmount: 50, currency: "AED", approverRole: "COMPANY_APPROVER",
      afterGovernanceLocks: async () => { locked(); await held; },
    });
    await signal;
    const erasure = eraseUserData(f.subject.id, f.platformAdmin.id);
    release();
    await expect(policy).resolves.toMatchObject({ name: "Before erasure" });
    await expect(erasure).resolves.toMatchObject({ anonymised: true });
  });

  it("rejects governed authority mutation after erasure wins", async () => {
    const f = await fixture("erase-before-policy", true);
    const approved = await db.purchaseOrder.create({ data: {
      poNumber: `ERASE-PO-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      companyId: f.company!.id,
      requesterId: f.subject.id,
      status: "APPROVED",
      currency: "AED",
      total: 25,
      approvalVersion: 1,
      approvedAt: new Date(),
      approvedCommercialFingerprint: "erasure-fixture",
    } });
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const signal = new Promise<void>((resolve) => { locked = resolve; });
    const erasure = eraseUserData(f.subject.id, f.platformAdmin.id, { afterGovernanceLocks: async () => { locked(); await held; } });
    await signal;
    const policy = createGovernedApprovalPolicy({
      companyId: f.company!.id, actorId: f.subject.id, name: "Blocked",
      thresholdAmount: 50, currency: "AED", approverRole: "COMPANY_APPROVER",
    });
    release();
    await expect(erasure).resolves.toMatchObject({ anonymised: true });
    await expect(policy).rejects.toThrow(/active current company membership/i);
    expect(await db.approvalPolicy.count({ where: { companyId: f.company!.id } })).toBe(0);
    await expect(db.purchaseOrder.findUniqueOrThrow({ where: { id: approved.id } })).resolves.toMatchObject({
      status: "PENDING_APPROVAL",
      approverId: null,
      approvedCommercialFingerprint: null,
      rejectionReason: "User account erased; reapproval required",
      approvalVersion: 2,
    });
    expect(await db.auditLog.count({
      where: {
        actorId: f.platformAdmin.id,
        entityType: "PurchaseOrder",
        entityId: approved.id,
        after: { path: ["reason"], equals: "USER_ERASED" },
      },
    })).toBe(1);
  });
});
