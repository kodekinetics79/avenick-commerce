import { afterEach, describe, expect, it } from "vitest";
import { db } from "../index";
import { setCompanyStatus, setUserStatus } from "../services/admin";

const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const users: string[] = [];
const companies: string[] = [];

async function fixture(label: string) {
  const stamp = `${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const [actor, superAdmin] = await Promise.all([
    db.user.create({ data: { email: `${stamp}-actor@test.invalid`, firstName: "Admin", lastName: "Actor", role: "ADMIN", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-super@test.invalid`, firstName: "Super", lastName: "Admin", role: "SUPER_ADMIN", status: "ACTIVE" } }),
  ]);
  users.push(actor.id, superAdmin.id);
  const company = await db.company.create({ data: { nameEn: stamp, industry: "OTHER", size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE" } });
  companies.push(company.id);
  return { actor, superAdmin, company };
}

afterEach(async () => {
  const actorIds = users.splice(0);
  const companyIds = companies.splice(0);
  await db.auditLog.deleteMany({ where: { actorId: { in: actorIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  await db.user.deleteMany({ where: { id: { in: actorIds } } });
});

run("platform admin actor revocation serialization", () => {
  it("rejects a company mutation after actor suspension wins", async () => {
    const f = await fixture("suspend-first");
    await setUserStatus({ userId: f.actor.id, status: "SUSPENDED", actorId: f.superAdmin.id, actorRole: "SUPER_ADMIN" });
    await expect(setCompanyStatus({ companyId: f.company.id, status: "SUSPENDED", actorId: f.actor.id }))
      .rejects.toThrow(/current admin authority/i);
    await expect(db.company.findUniqueOrThrow({ where: { id: f.company.id } })).resolves.toMatchObject({ status: "ACTIVE" });
  });

  it("lets an earlier company mutation commit before actor suspension", async () => {
    const f = await fixture("mutation-first");
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const signal = new Promise<void>((resolve) => { locked = resolve; });
    const mutation = setCompanyStatus({ companyId: f.company.id, status: "SUSPENDED", actorId: f.actor.id, afterCompanyLock: async () => { locked(); await held; } });
    await signal;
    const suspension = setUserStatus({ userId: f.actor.id, status: "SUSPENDED", actorId: f.superAdmin.id, actorRole: "SUPER_ADMIN" });
    release();
    await expect(mutation).resolves.toMatchObject({ status: "SUSPENDED" });
    await expect(suspension).resolves.toMatchObject({ status: "SUSPENDED" });
    expect(await db.auditLog.count({ where: { actorId: f.actor.id, entityType: "Company", entityId: f.company.id } })).toBe(1);
  });
});
