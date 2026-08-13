import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  DEPLOYED_INTEGRATION_INBOX_HANDLERS,
  getIntegrationRuntimeReadiness,
  processIntegrationInboxMessage,
  runIntegrationInboxWorkerOnce,
} from "../services/integration-worker";
import {
  claimIntegrationInbox,
  markIntegrationInboxProcessed,
  recordIntegrationInbound,
  redriveIntegrationInbox,
  StaleIntegrationLeaseError,
} from "../services/integrations";

const run = process.env.DATABASE_URL ? describe : describe.skip;
const marker = `inbound-worker-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
let actorId = "";
let orderId = "";

run("deployed inbound integration worker", () => {
  beforeAll(async () => {
    const actor = await db.user.create({ data: {
      email: `${marker}@example.test`, firstName: "Inbound", lastName: "Worker", role: "ADMIN", status: "ACTIVE",
    } });
    actorId = actor.id;
    const order = await db.order.create({ data: {
      orderNumber: marker, userId: actor.id, type: "B2B", currency: "AED",
      subtotal: 100, vatAmount: 5, total: 105, shippingAddress: { city: "Dubai" },
    } });
    orderId = order.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { OR: [{ actorId }, { entityId: { startsWith: marker } }] } });
    await db.integrationInbox.deleteMany({ where: { source: { startsWith: marker } } });
    await db.orderIntegrationState.deleteMany({ where: { orderId } });
    await db.order.deleteMany({ where: { id: orderId } });
    await db.integrationWorkerHealth.deleteMany({ where: { workerId: { startsWith: marker } } });
    await db.user.deleteMany({ where: { id: actorId } });
  });

  it("dispatches an ERP status through claim, handler and fenced acknowledgement", async () => {
    const source = `${marker}-erp`;
    const received = await recordIntegrationInbound({
      tenantKey: marker,
      source,
      externalEventId: `${marker}-accepted`,
      eventType: "ORDER_STATUS_CHANGED",
      payload: { orderId, status: "ACCEPTED", externalOrderId: "ERP-100", correlationId: "corr-100" },
    });
    const result = await runIntegrationInboxWorkerOnce({
      workerId: `${marker}-dispatch`, handlers: DEPLOYED_INTEGRATION_INBOX_HANDLERS, source, limit: 1,
    });
    expect(result).toMatchObject({ claimed: 1, results: [{ status: "PROCESSED" }] });
    await expect(db.integrationInbox.findUniqueOrThrow({ where: { id: received.row.id } }))
      .resolves.toMatchObject({ status: "PROCESSED", leaseOwner: null, lastError: null });
    await expect(db.orderIntegrationState.findUniqueOrThrow({
      where: { tenantKey_orderId_system: { tenantKey: marker, orderId, system: source } },
    })).resolves.toMatchObject({ state: "ACCEPTED", externalOrderId: "ERP-100", correlationId: "corr-100" });
  });

  it("retries, dead-letters, redrives and commits handler writes with acknowledgement", async () => {
    const source = `${marker}-retry`;
    const received = await recordIntegrationInbound({
      tenantKey: marker, source, externalEventId: `${marker}-retry-event`, eventType: "TEST", payload: { ok: true },
    });
    const [lease] = await claimIntegrationInbox({ workerId: `${marker}-failure`, source, limit: 1 });
    const failed = await processIntegrationInboxMessage(lease!, async () => { throw new Error("handler unavailable"); }, 1);
    expect(failed.status).toBe("DEAD");
    await expect(db.integrationInbox.findUniqueOrThrow({ where: { id: received.row.id } }))
      .resolves.toMatchObject({ status: "DEAD", attempts: 1, lastError: "handler unavailable" });

    await redriveIntegrationInbox(received.row.id, actorId);
    await expect(db.auditLog.findFirst({
      where: { actorId, entityType: "IntegrationInbox", entityId: received.row.id },
      orderBy: { createdAt: "desc" },
    })).resolves.toMatchObject({ action: "STATUS_CHANGE", after: { action: "MANUAL_REDRIVE", source } });
    const completed = await runIntegrationInboxWorkerOnce({
      workerId: `${marker}-redrive`, source, limit: 1,
      handlers: {
        [`${source}:TEST`]: async ({ message, tx, idempotencyKey }) => {
          await tx.auditLog.create({ data: {
            actorId, entityType: "InboundHandler", entityId: message.externalEventId, action: "CREATE",
            after: { idempotencyKey },
          } });
        },
      },
    });
    expect(completed).toMatchObject({ claimed: 1, results: [{ status: "PROCESSED" }] });
    expect(await db.auditLog.count({ where: { entityType: "InboundHandler", entityId: received.row.externalEventId } })).toBe(1);
  });

  it("reclaims an expired lease and fences the stale inbound worker", async () => {
    const source = `${marker}-fence`;
    const received = await recordIntegrationInbound({
      tenantKey: marker, source, externalEventId: `${marker}-fence-event`, eventType: "TEST", payload: {},
    });
    const [stale] = await claimIntegrationInbox({ workerId: `${marker}-stale`, source, limit: 1 });
    await db.integrationInbox.update({ where: { id: received.row.id }, data: { leaseExpiresAt: new Date(0) } });
    const [owner] = await claimIntegrationInbox({ workerId: `${marker}-owner`, source, limit: 1 });
    expect(owner).toMatchObject({ id: received.row.id, fencingToken: stale!.fencingToken + 1 });
    await expect(markIntegrationInboxProcessed(stale!)).rejects.toBeInstanceOf(StaleIntegrationLeaseError);
    await expect(markIntegrationInboxProcessed(owner!)).resolves.toBeUndefined();
  });

  it("reports inbound backlog, age, dead letters and expired leases in readiness", async () => {
    const source = `${marker}-readiness`;
    await db.integrationInbox.createMany({ data: [
      { tenantKey: marker, source, externalEventId: `${marker}-ready-pending`, eventType: "TEST", payload: {}, status: "RECEIVED", receivedAt: new Date(Date.now() - 10_000) },
      { tenantKey: marker, source, externalEventId: `${marker}-ready-dead`, eventType: "TEST", payload: {}, status: "DEAD" },
      { tenantKey: marker, source, externalEventId: `${marker}-ready-expired`, eventType: "TEST", payload: {}, status: "PROCESSING", leaseOwner: "gone", leaseExpiresAt: new Date(0) },
    ] });
    const readiness = await getIntegrationRuntimeReadiness();
    expect(readiness.inboxBacklog).toBeGreaterThanOrEqual(1);
    expect(readiness.inboxDead).toBeGreaterThanOrEqual(1);
    expect(readiness.inboxOverdue).toBeGreaterThanOrEqual(1);
    expect(readiness.inboundAgeMs).toBeGreaterThanOrEqual(9_000);
    expect(readiness.ok).toBe(true);
    expect(readiness.degraded).toBe(true);
  });
});
