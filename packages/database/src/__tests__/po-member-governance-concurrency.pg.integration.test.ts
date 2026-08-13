import { afterEach, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  createGovernedApprovalPolicy,
  createGovernedPurchaseOrder,
  placeGovernedPurchaseOrder,
  transitionGovernedPurchaseOrder,
  updateGovernedCompanyMember,
} from "../services/b2b-purchase-orders";

const run = process.env["DATABASE_URL"] ? describe.sequential : describe.skip;
const users: string[] = [];
const companies: string[] = [];

async function fixture(label: string, requiresApproval = false) {
  const stamp = `${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const [requester, approver, owner] = await Promise.all([
    db.user.create({ data: { email: `member-buyer-${stamp}@example.test`, firstName: "Member", lastName: "Buyer", role: "COMPANY_BUYER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `member-approver-${stamp}@example.test`, firstName: "Member", lastName: "Approver", role: "COMPANY_APPROVER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `member-owner-${stamp}@example.test`, firstName: "Member", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  users.push(requester.id, approver.id, owner.id);
  const seller = await db.sellerProfile.create({ data: {
    userId: owner.id, businessNameEn: stamp, crNumber: `MG-${stamp}`, type: "DISTRIBUTOR",
    country: "AE", city: "Dubai", status: "ACTIVE",
  } });
  const company = await db.company.create({ data: {
    nameEn: stamp, industry: "OTHER", size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE",
    members: { create: [
      { userId: requester.id, role: "COMPANY_BUYER", isActive: true, spendLimit: null },
      { userId: approver.id, role: "COMPANY_APPROVER", isActive: true, spendLimit: null },
    ] },
  }, include: { members: true } });
  companies.push(company.id);
  if (requiresApproval) await createGovernedApprovalPolicy({
    companyId: company.id, actorId: approver.id, name: `Approval ${stamp}`,
    thresholdAmount: 1, currency: "AED", approverRole: "COMPANY_APPROVER",
  });
  const category = await db.category.create({ data: { nameEn: stamp, nameAr: stamp, slug: `member-governance-${stamp}` } });
  const product = await db.product.create({ data: {
    sellerId: seller.id, categoryId: category.id, sku: `MG-${stamp}`, slug: `member-governance-${stamp}`,
    nameEn: "Governed member product", nameAr: "Governed member product", status: "ACTIVE", isB2BEnabled: true,
    prices: { create: { type: "B2B", currency: "AED", price: 100, vatRate: 5 } },
  } });
  const warehouse = await db.warehouse.create({ data: { sellerId: seller.id, nameEn: stamp, type: "SELLER", country: "AE", city: "Dubai" } });
  const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: `MG-${stamp}` } });
  await db.inventoryStock.create({ data: { productId: product.id, variantId: null, locationId: location.id, qty: 10 } });
  const po = await createGovernedPurchaseOrder({
    companyId: company.id, requesterId: requester.id, currency: "AED",
    items: [{ productId: product.id, quantity: 1 }],
  });
  expect(po.status).toBe(requiresApproval ? "PENDING_APPROVAL" : "APPROVED");
  return {
    requester, approver, company,
    member: company.members.find((row) => row.userId === requester.id)!,
    approverMember: company.members.find((row) => row.userId === approver.id)!,
    po,
  };
}

afterEach(async () => {
  const userIds = users.splice(0);
  const companyIds = companies.splice(0);
  if (!userIds.length) return;
  const sellers = await db.sellerProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const sellerIds = sellers.map(({ id }) => id);
  const orders = await db.order.findMany({ where: { OR: [{ userId: { in: userIds } }, { companyId: { in: companyIds } }] }, select: { id: true } });
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { entityType: "PurchaseOrder", entityId: { in: (await db.purchaseOrder.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } })).map(({ id }) => id) } }] } });
  await db.order.deleteMany({ where: { id: { in: orders.map(({ id }) => id) } } });
  await db.purchaseOrder.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.approvalPolicy.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.companyMember.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  await db.inventoryStock.deleteMany({ where: { product: { sellerId: { in: sellerIds } } } });
  await db.inventoryLocation.deleteMany({ where: { warehouse: { sellerId: { in: sellerIds } }, stock: { none: {} } } });
  await db.warehouse.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.product.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.category.deleteMany({ where: { slug: { startsWith: "member-governance-" }, products: { none: {} } } });
  await db.sellerProfile.deleteMany({ where: { id: { in: sellerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

run("PO member-governance concurrency", () => {
  it("rejects approval when role demotion wins the company lock", async () => {
    const { requester, approver, company, approverMember, po } = await fixture("demotion-first", true);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { locked = resolve; });
    const demotion = updateGovernedCompanyMember({
      memberId: approverMember.id, companyId: company.id, actorId: requester.id,
      role: "COMPANY_BUYER", spendLimit: null,
      afterGovernanceLock: async () => { locked(); await held; },
    });
    await lockAcquired;
    const approval = transitionGovernedPurchaseOrder({
      purchaseOrderId: po.id, companyId: company.id, actorId: approver.id, action: "approve",
    });
    release();

    await expect(demotion).resolves.toMatchObject({ invalidatedPurchaseOrderIds: [] });
    await expect(approval).rejects.toThrow(/requires COMPANY_APPROVER/i);
    await expect(db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).resolves.toMatchObject({
      status: "PENDING_APPROVAL", approverId: null, approvedAt: null,
    });
    await expect(db.auditLog.count({ where: {
      entityType: "PurchaseOrder", entityId: po.id, after: { path: ["status"], equals: "APPROVED" },
    } })).resolves.toBe(0);
  });

  it("invalidates and audits approval when approval wins before role demotion", async () => {
    const { requester, approver, company, approverMember, po } = await fixture("approval-first", true);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { locked = resolve; });
    const approval = transitionGovernedPurchaseOrder({
      purchaseOrderId: po.id, companyId: company.id, actorId: approver.id, action: "approve",
      afterApprovalLocks: async () => { locked(); await held; },
    });
    await lockAcquired;
    const demotion = updateGovernedCompanyMember({
      memberId: approverMember.id, companyId: company.id, actorId: requester.id,
      role: "COMPANY_BUYER", spendLimit: null,
    });
    release();

    await expect(approval).resolves.toMatchObject({ status: "APPROVED", approverId: approver.id });
    await expect(demotion).resolves.toMatchObject({ invalidatedPurchaseOrderIds: [po.id] });
    await expect(db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).resolves.toMatchObject({
      status: "PENDING_APPROVAL", approverId: null, approvedCommercialFingerprint: null,
    });
    const history = await db.auditLog.findMany({
      where: { entityType: "PurchaseOrder", entityId: po.id, action: "STATUS_CHANGE" },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((row) => (row.after as { status?: string }).status)).toEqual(["APPROVED", "PENDING_APPROVAL"]);
    expect(history[1]?.after).toMatchObject({ reason: "MEMBER_GOVERNANCE_CHANGED" });
  });

  it("invalidates approval and creates no order when a lowered limit wins the company lock", async () => {
    const { requester, company, member, po } = await fixture("limit-first");
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { locked = resolve; });
    const update = updateGovernedCompanyMember({
      memberId: member.id, companyId: company.id, actorId: requester.id,
      role: "COMPANY_BUYER", spendLimit: 50,
      afterGovernanceLock: async () => { locked(); await held; },
    });
    await lockAcquired;
    const placement = placeGovernedPurchaseOrder({ purchaseOrderId: po.id, companyId: company.id, actorId: requester.id });
    release();

    await expect(update).resolves.toMatchObject({ invalidatedPurchaseOrderIds: [po.id] });
    await expect(placement).rejects.toThrow(/approved purchase order/i);
    await expect(db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).resolves.toMatchObject({
      status: "PENDING_APPROVAL", approverId: null, approvedCommercialFingerprint: null,
    });
    await expect(db.order.count({ where: { purchaseOrderId: po.id } })).resolves.toBe(0);
    await expect(db.auditLog.count({ where: {
      entityType: "PurchaseOrder", entityId: po.id, after: { path: ["reason"], equals: "MEMBER_GOVERNANCE_CHANGED" },
    } })).resolves.toBe(1);
  });

  it("preserves and records an earlier placement claim before applying the lowered limit", async () => {
    const { requester, company, member, po } = await fixture("placement-first");
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { locked = resolve; });
    let update!: ReturnType<typeof updateGovernedCompanyMember>;
    const placement = placeGovernedPurchaseOrder({
      purchaseOrderId: po.id, companyId: company.id, actorId: requester.id,
      afterPlacementLocks: async () => { locked(); await held; },
      afterPlacementClaim: async () => { await update; },
    });
    await lockAcquired;
    update = updateGovernedCompanyMember({
      memberId: member.id, companyId: company.id, actorId: requester.id,
      role: "COMPANY_BUYER", spendLimit: 50,
    });
    release();

    const [order, changed] = await Promise.all([placement, update]);
    expect(order.purchaseOrderId).toBe(po.id);
    expect(changed.invalidatedPurchaseOrderIds).toEqual([]);
    expect(changed.preservedPlacementClaims).toEqual([{ id: po.id, status: "PLACING" }]);
    await expect(db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).resolves.toMatchObject({ status: "ORDERED" });
    await expect(db.auditLog.findFirstOrThrow({ where: { entityType: "CompanyMember", entityId: member.id }, orderBy: { createdAt: "desc" } }))
      .resolves.toMatchObject({ after: expect.objectContaining({ preservedPlacementClaims: [{ id: po.id, status: "PLACING" }] }) });
  });
});
