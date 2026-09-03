import { afterEach, describe, expect, it } from "vitest";
import { db } from "../index";
import { setCompanyStatus, setUserStatus } from "../services/admin";
import { createGovernedPurchaseOrder, placeGovernedPurchaseOrder, transitionGovernedPurchaseOrder, updateGovernedCompanyMember } from "../services/b2b-purchase-orders";
import { lockInventoryStockRows } from "../services/checkout-invariants";
import { secureCreateOrder } from "../services/secure-checkout";

const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const users: string[] = [];
const companies: string[] = [];

async function fixture(label: string, b2b: boolean) {
  const stamp = `${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const [buyer, owner, admin, platformAdmin] = await Promise.all([
    db.user.create({ data: { email: `${stamp}-buyer@test.invalid`, firstName: "IAM", lastName: "Buyer", role: b2b ? "COMPANY_BUYER" : "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-owner@test.invalid`, firstName: "IAM", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-admin@test.invalid`, firstName: "IAM", lastName: "Admin", role: b2b ? "COMPANY_ADMIN" : "SUPER_ADMIN", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-platform@test.invalid`, firstName: "IAM", lastName: "Platform", role: "SUPER_ADMIN", status: "ACTIVE" } }),
  ]);
  users.push(buyer.id, owner.id, admin.id, platformAdmin.id);
  const seller = await db.sellerProfile.create({ data: {
    userId: owner.id, businessNameEn: stamp, crNumber: `IAM-${stamp}`, type: "DISTRIBUTOR",
    country: "AE", city: "Dubai", status: "ACTIVE",
  } });
  const category = await db.category.create({ data: { nameEn: stamp, nameAr: stamp, slug: `iam-revocation-${stamp}` } });
  const product = await db.product.create({ data: {
    sellerId: seller.id, categoryId: category.id, sku: `IAM-${stamp}`, slug: `iam-${stamp}`,
    nameEn: "IAM product", nameAr: "IAM product", status: "ACTIVE", isB2CEnabled: !b2b, isB2BEnabled: b2b,
    prices: { create: { type: b2b ? "B2B" : "B2C", currency: "AED", price: 100, vatRate: 5 } },
  } });
  const warehouse = await db.warehouse.create({ data: { sellerId: seller.id, nameEn: stamp, type: "SELLER", country: "AE", city: "Dubai" } });
  const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: stamp } });
  const stock = await db.inventoryStock.create({ data: { productId: product.id, locationId: location.id, qty: 20 } });
  let company: Awaited<ReturnType<typeof db.company.create>> | undefined;
  let member: Awaited<ReturnType<typeof db.companyMember.create>> | undefined;
  if (b2b) {
    company = await db.company.create({ data: { nameEn: stamp, industry: "OTHER", size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE" } });
    companies.push(company.id);
    member = await db.companyMember.create({ data: { companyId: company.id, userId: buyer.id, role: "COMPANY_BUYER", isActive: true } });
    await db.companyMember.create({ data: { companyId: company.id, userId: admin.id, role: "COMPANY_ADMIN", isActive: true } });
  }
  return { buyer, admin, platformAdmin, product, stock, company, member };
}

/**
 * Block until the checkout under test actually holds the user's commerce fence.
 *
 * What these cases assert is ORDER — that a transaction which took the fence
 * first commits, and the revocation racing it does not overtake it. They do not
 * assert speed. The budget was 100 attempts at 10ms, which is a wall-clock
 * assumption dressed as a loop count, and it was tuned against a local
 * database. This suite runs against a REMOTE Postgres at roughly 12ms per
 * round trip, in parallel with the other pg suites on the same instance, so
 * under contention the fence could be taken later than the budget allowed and
 * the revocation would start first — failing an assertion about ordering for a
 * reason that has nothing to do with ordering.
 *
 * A deadline says the same thing without pretending to know how fast the
 * database is. If the fence is genuinely never taken this still throws, so
 * nothing is weakened: a real ordering failure fails exactly as before.
 */
const FENCE_WAIT_MS = 15_000;

async function waitForUserFence(userId: string) {
  const deadline = Date.now() + FENCE_WAIT_MS;
  while (Date.now() < deadline) {
    const [row] = await db.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${`user-commerce:${userId}`})) AS acquired
    `;
    // acquired === false means someone else holds it — that someone is the
    // checkout we are waiting for.
    if (row?.acquired === false) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `Timed out after ${FENCE_WAIT_MS}ms waiting for the user commerce fence on ${userId}. ` +
      "The checkout never took the fence, so the ordering this test asserts never began.",
  );
}

afterEach(async () => {
  const userIds = users.splice(0);
  const companyIds = companies.splice(0);
  if (!userIds.length) return;
  const sellers = await db.sellerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const sellerIds = sellers.map(({ id }) => id);
  await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await db.order.deleteMany({ where: { userId: { in: userIds } } });
  await db.purchaseOrder.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.companyMember.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  await db.inventoryStock.deleteMany({ where: { product: { sellerId: { in: sellerIds } } } });
  await db.inventoryLocation.deleteMany({ where: { warehouse: { sellerId: { in: sellerIds } }, stock: { none: {} } } });
  await db.warehouse.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.product.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.category.deleteMany({ where: { slug: { startsWith: "iam-revocation-" }, products: { none: {} } } });
  await db.sellerProfile.deleteMany({ where: { id: { in: sellerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

run("IAM revocation and order serialization", () => {
  it("rejects B2B checkout and PO creation after company suspension wins", async () => {
    const f = await fixture("company-first", true);
    const po = await createGovernedPurchaseOrder({ companyId: f.company!.id, requesterId: f.buyer.id, currency: "AED", items: [{ productId: f.product.id, quantity: 1 }] });
    await setCompanyStatus({ companyId: f.company!.id, status: "SUSPENDED", actorId: f.platformAdmin.id });
    await expect(placeGovernedPurchaseOrder({ purchaseOrderId: po.id, companyId: f.company!.id, actorId: f.buyer.id })).rejects.toThrow(/active current company membership|approved purchase order/i);
    await expect(createGovernedPurchaseOrder({ companyId: f.company!.id, requesterId: f.buyer.id, currency: "AED", items: [{ productId: f.product.id, quantity: 1 }] })).rejects.toThrow(/active current company membership/i);
  });

  it("lets earlier PO creation finish then suspension invalidates its approval", async () => {
    const f = await fixture("po-before-company", true);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const lockSignal = new Promise<void>((resolve) => { locked = resolve; });
    const creation = createGovernedPurchaseOrder({
      companyId: f.company!.id, requesterId: f.buyer.id, currency: "AED", items: [{ productId: f.product.id, quantity: 1 }],
      afterGovernanceLocks: async () => { locked(); await held; },
    });
    await lockSignal;
    const suspension = setCompanyStatus({ companyId: f.company!.id, status: "SUSPENDED", actorId: f.platformAdmin.id });
    release();
    const [po] = await Promise.all([creation, suspension]);
    await expect(db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).resolves.toMatchObject({ status: "PENDING_APPROVAL" });
  });

  it("revoked company admin cannot mutate members, cancel, or place", async () => {
    const f = await fixture("actor-revoked", true);
    const po = await createGovernedPurchaseOrder({ companyId: f.company!.id, requesterId: f.buyer.id, currency: "AED", items: [{ productId: f.product.id, quantity: 1 }] });
    await setUserStatus({ userId: f.admin.id, status: "SUSPENDED", actorId: f.platformAdmin.id, actorRole: "SUPER_ADMIN" });
    await expect(updateGovernedCompanyMember({ memberId: f.member!.id, companyId: f.company!.id, actorId: f.admin.id, role: "COMPANY_BUYER", spendLimit: 50 })).rejects.toThrow(/active current company membership/i);
    await expect(transitionGovernedPurchaseOrder({ purchaseOrderId: po.id, companyId: f.company!.id, actorId: f.admin.id, action: "cancel" })).rejects.toThrow(/active current company membership/i);
    await expect(placeGovernedPurchaseOrder({ purchaseOrderId: po.id, companyId: f.company!.id, actorId: f.admin.id })).rejects.toThrow(/active current company membership/i);
  });

  it("lets an earlier member mutation commit before actor suspension", async () => {
    const f = await fixture("mutation-before-revoke", true);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const lockSignal = new Promise<void>((resolve) => { locked = resolve; });
    const mutation = updateGovernedCompanyMember({
      memberId: f.member!.id, companyId: f.company!.id, actorId: f.admin.id, role: "COMPANY_BUYER", spendLimit: 50,
      afterGovernanceLock: async () => { locked(); await held; },
    });
    await lockSignal;
    const suspension = setUserStatus({ userId: f.admin.id, status: "SUSPENDED", actorId: f.platformAdmin.id, actorRole: "SUPER_ADMIN" });
    release();
    await expect(mutation).resolves.toMatchObject({ member: { spendLimit: expect.anything() } });
    await expect(suspension).resolves.toMatchObject({ status: "SUSPENDED" });
  });

  it("invalidates an approved PO when membership deactivation wins", async () => {
    const f = await fixture("member-first", true);
    const po = await createGovernedPurchaseOrder({ companyId: f.company!.id, requesterId: f.buyer.id, currency: "AED", items: [{ productId: f.product.id, quantity: 1 }] });
    const changed = await updateGovernedCompanyMember({ memberId: f.member!.id, companyId: f.company!.id, actorId: f.admin.id, role: "COMPANY_BUYER", spendLimit: null, isActive: false });
    expect(changed.invalidatedPurchaseOrderIds).toEqual([po.id]);
    await expect(placeGovernedPurchaseOrder({ purchaseOrderId: po.id, companyId: f.company!.id, actorId: f.admin.id })).rejects.toThrow(/approved purchase order/i);
    expect(await db.order.count({ where: { purchaseOrderId: po.id } })).toBe(0);
  });

  it("lets an earlier governed placement commit before membership deactivation", async () => {
    const f = await fixture("placement-first", true);
    const po = await createGovernedPurchaseOrder({ companyId: f.company!.id, requesterId: f.buyer.id, currency: "AED", items: [{ productId: f.product.id, quantity: 1 }] });
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const lockedSignal = new Promise<void>((resolve) => { locked = resolve; });
    const blocker = db.$transaction(async (tx) => { await lockInventoryStockRows(tx, [f.stock.id]); locked(); await held; });
    await lockedSignal;
    const placement = placeGovernedPurchaseOrder({ purchaseOrderId: po.id, companyId: f.company!.id, actorId: f.admin.id });
    await waitForUserFence(f.buyer.id);
    const deactivate = updateGovernedCompanyMember({ memberId: f.member!.id, companyId: f.company!.id, actorId: f.admin.id, role: "COMPANY_BUYER", spendLimit: null, isActive: false });
    release();
    await blocker;
    await expect(placement).resolves.toMatchObject({ purchaseOrderId: po.id });
    await expect(deactivate).resolves.toMatchObject({ invalidatedPurchaseOrderIds: [] });
  });

  it("rejects B2C checkout after suspension wins", async () => {
    const f = await fixture("suspend-first", false);
    await setUserStatus({ userId: f.buyer.id, status: "SUSPENDED", actorId: f.platformAdmin.id, actorRole: "SUPER_ADMIN" });
    await expect(secureCreateOrder({ userId: f.buyer.id, type: "B2C", currency: "AED", items: [{ productId: f.product.id, quantity: 1 }], shippingAddress: { line1: "Test", city: "Dubai", country: "AE" } })).rejects.toThrow(/not active/i);
  });

  it("lets an earlier B2C checkout commit before suspension", async () => {
    const f = await fixture("checkout-first", false);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const lockedSignal = new Promise<void>((resolve) => { locked = resolve; });
    const blocker = db.$transaction(async (tx) => { await lockInventoryStockRows(tx, [f.stock.id]); locked(); await held; });
    await lockedSignal;
    const checkout = secureCreateOrder({ userId: f.buyer.id, type: "B2C", currency: "AED", items: [{ productId: f.product.id, quantity: 1 }], shippingAddress: { line1: "Test", city: "Dubai", country: "AE" } });
    await waitForUserFence(f.buyer.id);
    const suspension = setUserStatus({ userId: f.buyer.id, status: "SUSPENDED", actorId: f.platformAdmin.id, actorRole: "SUPER_ADMIN" });
    release();
    await blocker;
    await expect(checkout).resolves.toMatchObject({ userId: f.buyer.id });
    await expect(suspension).resolves.toMatchObject({ status: "SUSPENDED" });
  });
});
