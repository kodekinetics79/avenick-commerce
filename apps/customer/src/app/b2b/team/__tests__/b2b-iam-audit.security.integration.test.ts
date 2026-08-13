import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@avenick/database";

const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth-instance", () => ({ auth: vi.fn(async () => ({ user: { id: actor.id } })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { setMemberActive, updateMember } from "../actions";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
let companyId = "", adminMemberId = "", targetMemberId = "", targetUserId = "";
const userIds: string[] = [];

beforeAll(async () => {
  const company = await db.company.create({ data: {
    nameEn: `IAM ${stamp}`, crNumber: `IAM-${stamp}`, industry: "BUILDING_MATERIALS",
    size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE",
  } });
  companyId = company.id;
  const [admin, target] = await Promise.all([
    db.user.create({ data: { email: `iam-admin-${stamp}@example.test`, firstName: "IAM", lastName: "Admin", role: "COMPANY_ADMIN", status: "ACTIVE" } }),
    db.user.create({ data: { email: `iam-target-${stamp}@example.test`, firstName: "IAM", lastName: "Target", role: "COMPANY_BUYER", status: "ACTIVE" } }),
  ]);
  userIds.push(admin.id, target.id); actor.id = admin.id; targetUserId = target.id;
  const [adminMember, targetMember] = await Promise.all([
    db.companyMember.create({ data: { companyId, userId: admin.id, role: "COMPANY_ADMIN" } }),
    db.companyMember.create({ data: { companyId, userId: target.id, role: "COMPANY_BUYER" } }),
  ]);
  adminMemberId = adminMember.id; targetMemberId = targetMember.id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  if (companyId) await db.companyMember.deleteMany({ where: { companyId } });
  if (companyId) await db.company.deleteMany({ where: { id: companyId } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("B2B IAM durable state and actor audit", () => {
  it("atomically changes member and user roles with actor before/after evidence", async () => {
    const form = new FormData();
    form.set("role", "COMPANY_APPROVER");
    form.set("spendLimit", "7500");
    await updateMember(targetMemberId, form);
    expect(await db.companyMember.findUnique({ where: { id: targetMemberId } })).toMatchObject({ role: "COMPANY_APPROVER" });
    expect(await db.user.findUnique({ where: { id: targetUserId } })).toMatchObject({ role: "COMPANY_APPROVER" });
    const audit = await db.auditLog.findFirst({ where: { actorId: actor.id, entityType: "CompanyMember", entityId: targetMemberId }, orderBy: { createdAt: "desc" } });
    expect(audit).toMatchObject({ action: "UPDATE" });
    expect(audit?.before).toMatchObject({ role: "COMPANY_BUYER", companyId });
    expect(audit?.after).toMatchObject({ role: "COMPANY_APPROVER", companyId });
  });

  it("audits revocation and immediately denies a revoked admin membership", async () => {
    await setMemberActive(targetMemberId, false);
    expect(await db.auditLog.findFirst({ where: { actorId: actor.id, entityId: targetMemberId, action: "UPDATE" }, orderBy: { createdAt: "desc" } }))
      .toMatchObject({ after: { companyId, isActive: false } });
    await db.companyMember.update({ where: { id: adminMemberId }, data: { isActive: false } });
    const form = new FormData(); form.set("role", "COMPANY_BUYER");
    await updateMember(targetMemberId, form);
    expect(await db.companyMember.findUnique({ where: { id: targetMemberId } })).toMatchObject({ role: "COMPANY_APPROVER" });
  });
});
