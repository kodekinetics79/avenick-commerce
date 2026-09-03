import { afterEach, describe, expect, it } from "vitest";
import { db } from "../index";
import { setUserStatus } from "../services/admin";
import {
  createGovernedApprovalPolicy,
  setGovernedApprovalPolicyActive,
  updateGovernedCompanyMember,
} from "../services/b2b-purchase-orders";

const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const userIds: string[] = [];
const companyIds: string[] = [];

async function fixture(label: string) {
  const stamp = `${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const [actor, revoker, buyer, platformAdmin] = await Promise.all([
    db.user.create({ data: { email: `${stamp}-actor@test.invalid`, firstName: "Policy", lastName: "Actor", role: "COMPANY_ADMIN", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-revoker@test.invalid`, firstName: "Policy", lastName: "Revoker", role: "COMPANY_ADMIN", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-buyer@test.invalid`, firstName: "Policy", lastName: "Buyer", role: "COMPANY_BUYER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-platform@test.invalid`, firstName: "Policy", lastName: "Platform", role: "SUPER_ADMIN", status: "ACTIVE" } }),
  ]);
  userIds.push(actor.id, revoker.id, buyer.id, platformAdmin.id);
  const company = await db.company.create({ data: {
    nameEn: stamp, industry: "OTHER", size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE",
    members: { create: [
      { userId: actor.id, role: "COMPANY_ADMIN", isActive: true },
      { userId: revoker.id, role: "COMPANY_ADMIN", isActive: true },
      { userId: buyer.id, role: "COMPANY_BUYER", isActive: true },
    ] },
  }, include: { members: true } });
  companyIds.push(company.id);
  return {
    actor, revoker, buyer, platformAdmin, company,
    actorMember: company.members.find((member) => member.userId === actor.id)!,
  };
}

async function approvedPO(companyId: string, requesterId: string, label: string) {
  return db.purchaseOrder.create({ data: {
    poNumber: `POLICY-${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    companyId, requesterId, status: "APPROVED", currency: "AED", total: 100,
    approvalVersion: 1, approvedAt: new Date(), approvedCommercialFingerprint: "fixture",
  } });
}

afterEach(async () => {
  const users = userIds.splice(0);
  const companies = companyIds.splice(0);
  if (!users.length) return;
  await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await db.purchaseOrder.deleteMany({ where: { companyId: { in: companies } } });
  await db.approvalPolicy.deleteMany({ where: { companyId: { in: companies } } });
  await db.companyMember.deleteMany({ where: { companyId: { in: companies } } });
  await db.company.deleteMany({ where: { id: { in: companies } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
});

run("approval-policy actor revocation serialization", () => {
  it("rejects policy creation after member deactivation wins", async () => {
    const f = await fixture("deactivate-first");
    await updateGovernedCompanyMember({ memberId: f.actorMember.id, companyId: f.company.id, actorId: f.revoker.id, role: "COMPANY_ADMIN", spendLimit: null, isActive: false });
    await expect(createGovernedApprovalPolicy({ companyId: f.company.id, actorId: f.actor.id, name: "Blocked", thresholdAmount: 50, currency: "AED", approverRole: "COMPANY_APPROVER" }))
      .rejects.toThrow(/active current company membership/i);
    expect(await db.approvalPolicy.count({ where: { companyId: f.company.id } })).toBe(0);
  });

  it("lets earlier policy creation commit before actor demotion and truthfully invalidates approval", async () => {
    const f = await fixture("create-first");
    const po = await approvedPO(f.company.id, f.buyer.id, "create-first");
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const signal = new Promise<void>((resolve) => { locked = resolve; });
    const creation = createGovernedApprovalPolicy({ companyId: f.company.id, actorId: f.actor.id, name: "First", thresholdAmount: 50, currency: "AED", approverRole: "COMPANY_APPROVER", afterGovernanceLocks: async () => { locked(); await held; } });
    await signal;
    const demotion = updateGovernedCompanyMember({ memberId: f.actorMember.id, companyId: f.company.id, actorId: f.revoker.id, role: "COMPANY_BUYER", spendLimit: null });
    release();
    await expect(creation).resolves.toMatchObject({ name: "First" });
    await expect(demotion).resolves.toMatchObject({ member: { role: "COMPANY_BUYER" } });
    await expect(db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).resolves.toMatchObject({ status: "PENDING_APPROVAL" });
  });

  it("rejects policy toggle after user suspension wins", async () => {
    const f = await fixture("suspend-first");
    const policy = await createGovernedApprovalPolicy({ companyId: f.company.id, actorId: f.actor.id, name: "Toggle", thresholdAmount: 50, currency: "AED", approverRole: "COMPANY_APPROVER" });
    await setUserStatus({ userId: f.actor.id, status: "SUSPENDED", actorId: f.platformAdmin.id, actorRole: "SUPER_ADMIN" });
    await expect(setGovernedApprovalPolicyActive({ policyId: policy.id, companyId: f.company.id, actorId: f.actor.id, isActive: false }))
      .rejects.toThrow(/active current company membership/i);
    await expect(db.approvalPolicy.findUniqueOrThrow({ where: { id: policy.id } })).resolves.toMatchObject({ isActive: true });
  });

  it("lets earlier toggle commit before member deactivation and audits invalidation", async () => {
    const f = await fixture("toggle-first");
    const policy = await createGovernedApprovalPolicy({ companyId: f.company.id, actorId: f.actor.id, name: "Toggle", thresholdAmount: 50, currency: "AED", approverRole: "COMPANY_APPROVER" });
    const po = await approvedPO(f.company.id, f.buyer.id, "toggle-first");
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const signal = new Promise<void>((resolve) => { locked = resolve; });
    const toggle = setGovernedApprovalPolicyActive({ policyId: policy.id, companyId: f.company.id, actorId: f.actor.id, isActive: false, afterGovernanceLocks: async () => { locked(); await held; } });
    await signal;
    const revoke = updateGovernedCompanyMember({ memberId: f.actorMember.id, companyId: f.company.id, actorId: f.revoker.id, role: "COMPANY_ADMIN", spendLimit: null, isActive: false });
    release();
    await expect(toggle).resolves.toMatchObject({ isActive: false });
    await expect(revoke).resolves.toMatchObject({ member: { isActive: false } });
    await expect(db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).resolves.toMatchObject({ status: "PENDING_APPROVAL" });
    expect(await db.auditLog.count({ where: { actorId: f.actor.id, entityType: "PurchaseOrder", entityId: po.id, after: { path: ["reason"], equals: "POLICY_CHANGED" } } })).toBe(1);
  });
});
