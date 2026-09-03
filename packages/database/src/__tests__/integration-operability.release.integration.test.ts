import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { getIntegrationRuntimeReadiness, probeDueIntegrationConnections } from "../services/integration-worker";
import { getIntegrationOperationalSummary } from "../services/integrations";
import type { ErpAdapter } from "../services/erp-adapter";

const run = process.env.DATABASE_URL ? describe : describe.skip;
const marker = `integration-operability-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
let connectionId = "";

const adapter = (ok: boolean): ErpAdapter => ({
  system: marker,
  healthCheck: async () => ({ ok, system: marker }),
  resolveCustomer: async () => ({ externalCustomerId: "customer" }),
  resolveProduct: async () => ({ externalProductId: "product" }),
  resolvePrice: async () => ({ unitPrice: 1, currency: "AED" }),
  resolveAvailability: async () => ({ available: true, availableQty: 1 }),
  submitOrder: async () => ({ disposition: "ACCEPTED", externalOrderId: "order", correlationId: "correlation", duplicate: false }),
  getOrderStatus: async () => ({ status: "ACCEPTED" }),
});

run("integration operational readiness", () => {
  beforeAll(async () => {
    const connection = await db.integrationConnection.create({ data: {
      tenantKey: marker,
      system: "ERP",
      connectionKey: marker,
      name: marker,
      status: "ACTIVE",
      baseUrl: "https://erp.example.test",
      credentialsRef: "env:INTEGRATION_ERP_TOKEN",
    } });
    connectionId = connection.id;
  });

  afterAll(async () => {
    await db.integrationOutbox.deleteMany({ where: { connectionId } });
    await db.integrationInbox.deleteMany({ where: { tenantKey: marker } });
    await db.integrationConnection.deleteMany({ where: { id: connectionId } });
  });

  it("persists successful and failed connector probes while queues are idle", async () => {
    const first = new Date("2026-08-13T12:00:00.000Z");
    await expect(probeDueIntegrationConnections({
      connectionId, now: first, resolveAdapter: async () => adapter(true),
    })).resolves.toEqual([{ connectionId, ok: true }]);
    await expect(db.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } }))
      .resolves.toMatchObject({ lastHealthCheckAt: first, lastError: null });

    const second = new Date(first.getTime() + 61_000);
    await expect(probeDueIntegrationConnections({
      connectionId, now: second, resolveAdapter: async () => adapter(false),
    })).resolves.toMatchObject([{ connectionId, ok: false }]);
    const failed = await db.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(failed.lastHealthCheckAt).toEqual(second);
    expect(failed.lastFailureAt).not.toBeNull();
    expect(failed.lastError).toMatch(/health check failed/i);
  });

  it("keeps web readiness serving while reporting queue degradation even after a connection is disabled", async () => {
    await db.integrationOutbox.create({ data: {
      tenantKey: marker,
      aggregateType: "ORDER",
      aggregateId: marker,
      eventType: "ORDER_SUBMIT_REQUESTED",
      destination: "ERP",
      connectionId,
      payload: {},
      idempotencyKey: marker,
      status: "DEAD",
      attempts: 8,
      lastError: "poison message",
    } });
    await db.integrationConnection.update({ where: { id: connectionId }, data: { status: "DISABLED" } });
    const readiness = await getIntegrationRuntimeReadiness();
    expect(readiness.ok).toBe(true);
    expect(readiness.degraded).toBe(true);
    await expect(db.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } }))
      .resolves.toMatchObject({ status: "DISABLED" });
    expect(readiness.dead).toBeGreaterThanOrEqual(1);
  });

  it("reports real inbound retry and dead-letter states", async () => {
    await db.integrationInbox.createMany({ data: [
      { tenantKey: marker, source: marker, externalEventId: `${marker}-retry`, eventType: "TEST", payload: {}, status: "RETRY" },
      { tenantKey: marker, source: marker, externalEventId: `${marker}-dead`, eventType: "TEST", payload: {}, status: "DEAD" },
    ] });
    const summary = await getIntegrationOperationalSummary(marker);
    expect(summary.inbox).toMatchObject({ retry: 1, dead: 1 });
    expect(summary.inbox.failed).toBeUndefined();
  });
});
