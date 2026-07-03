import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load DATABASE_URL from the repo root .env when not already set (vitest does
// not load Next.js env files).
if (!process.env["DATABASE_URL"]) {
  try {
    const env = readFileSync(resolve(__dirname, "../../../../.env"), "utf8");
    const match = env.match(/^DATABASE_URL="?([^"\n]+)"?/m);
    if (match?.[1]) process.env["DATABASE_URL"] = match[1];
  } catch {
    // fall through — the suite will fail loudly below
  }
}

import { db } from "../index";
import { checkDatabaseHealth } from "../services/health";
import { getAuditLogs, getAuditEntityTypes } from "../services/audit";
import { getAdminUsers, getAdminCompanies, setUserStatus } from "../services/admin";

const STAMP = Date.now();
const actorEmail = `it-actor-${STAMP}@example.test`;
const targetEmail = `it-target-${STAMP}@example.test`;
const rootEmail = `it-root-${STAMP}@example.test`;

let actorId: string;
let targetId: string;
let rootId: string;

beforeAll(async () => {
  const [actor, target, root] = await Promise.all([
    db.user.create({
      data: { email: actorEmail, firstName: "IT", lastName: "Actor", role: "ADMIN", status: "ACTIVE" },
    }),
    db.user.create({
      data: { email: targetEmail, firstName: "IT", lastName: "Target", role: "CONSUMER", status: "ACTIVE" },
    }),
    db.user.create({
      data: { email: rootEmail, firstName: "IT", lastName: "Root", role: "SUPER_ADMIN", status: "ACTIVE" },
    }),
  ]);
  actorId = actor.id;
  targetId = target.id;
  rootId = root.id;
});

afterAll(async () => {
  const ids = [actorId, targetId, rootId].filter(Boolean);
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: ids } }] } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe("database health", () => {
  it("reports a reachable database with latency", async () => {
    const health = await checkDatabaseHealth();
    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.error).toBeUndefined();
  });
});

describe("getAdminUsers", () => {
  it("returns paginated users with role counts", async () => {
    const { users, total, roleCounts } = await getAdminUsers({ page: 1, limit: 5 });
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeLessThanOrEqual(5);
    expect(total).toBeGreaterThanOrEqual(users.length);
    expect(roleCounts.length).toBeGreaterThan(0);
    for (const u of users) {
      expect(u).toHaveProperty("email");
      expect(u).not.toHaveProperty("passwordHash");
    }
  });

  it("filters by search term", async () => {
    const { users } = await getAdminUsers({ page: 1, limit: 10, search: `it-target-${STAMP}` });
    expect(users.map((u) => u.email)).toContain(targetEmail);
  });

  it("filters by role", async () => {
    const { users } = await getAdminUsers({ page: 1, limit: 100, role: "SUPER_ADMIN" });
    expect(users.every((u) => u.role === "SUPER_ADMIN")).toBe(true);
  });
});

describe("setUserStatus — RBAC and audit trail", () => {
  it("suspends a user and writes an audit entry", async () => {
    const updated = await setUserStatus({
      userId: targetId,
      status: "SUSPENDED",
      actorId,
      actorRole: "ADMIN",
      reason: "integration test",
    });
    expect(updated.status).toBe("SUSPENDED");

    const audit = await db.auditLog.findFirst({
      where: { entityType: "User", entityId: targetId, action: "SUSPEND" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorId).toBe(actorId);
    expect(audit!.before).toMatchObject({ status: "ACTIVE" });
    expect(audit!.after).toMatchObject({ status: "SUSPENDED", reason: "integration test" });
  });

  it("refuses to let an ADMIN modify a SUPER_ADMIN account", async () => {
    await expect(
      setUserStatus({ userId: rootId, status: "SUSPENDED", actorId, actorRole: "ADMIN" }),
    ).rejects.toThrow(/super admin/i);
  });

  it("refuses self-status changes", async () => {
    await expect(
      setUserStatus({ userId: actorId, status: "SUSPENDED", actorId, actorRole: "ADMIN" }),
    ).rejects.toThrow(/own account/i);
  });

  it("re-activates with an ACTIVATE audit action", async () => {
    const updated = await setUserStatus({
      userId: targetId,
      status: "ACTIVE",
      actorId,
      actorRole: "SUPER_ADMIN",
    });
    expect(updated.status).toBe("ACTIVE");
    const audit = await db.auditLog.findFirst({
      where: { entityType: "User", entityId: targetId, action: "ACTIVATE" },
    });
    expect(audit).not.toBeNull();
  });
});

describe("getAuditLogs", () => {
  it("returns newest-first entries with actor identity", async () => {
    const { logs, total } = await getAuditLogs({ page: 1, limit: 10 });
    expect(total).toBeGreaterThan(0);
    expect(logs.length).toBeGreaterThan(0);
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(logs[i]!.createdAt.getTime());
    }
  });

  it("filters by entityType", async () => {
    const { logs } = await getAuditLogs({ page: 1, limit: 10, entityType: "User" });
    expect(logs.every((l) => l.entityType === "User")).toBe(true);
  });

  it("lists distinct entity types", async () => {
    const types = await getAuditEntityTypes();
    expect(types).toContain("User");
  });
});

describe("getAdminCompanies", () => {
  it("returns companies with workflow counts", async () => {
    const { companies, total, statusCounts } = await getAdminCompanies({ page: 1, limit: 10 });
    expect(total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(statusCounts)).toBe(true);
    for (const c of companies) {
      expect(c._count).toHaveProperty("members");
      expect(c._count).toHaveProperty("orders");
    }
  });
});
