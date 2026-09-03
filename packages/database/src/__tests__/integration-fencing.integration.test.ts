import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { DeterministicCertificationErpAdapter, type ErpCertificationScenario } from "../services/erp-adapter";
import { processIntegrationOutboxMessage } from "../services/integration-worker";
import {
  claimIntegrationOutbox,
  completeIntegrationOutbox,
  failIntegrationOutbox,
  heartbeatIntegrationOutbox,
  recordIntegrationInbound,
  redriveIntegrationOutbox,
  StaleIntegrationLeaseError,
} from "../services/integrations";

const enabled = Boolean(process.env.DATABASE_URL);
const run = enabled ? describe : describe.skip;
const marker = `fencing-${Date.now()}`;
let operatorId = "";
let connectionId = "";

run("fenced integration leases", () => {
  beforeAll(async () => {
    const operator = await db.user.create({
      data: {
        email: `${marker}@example.test`,
        firstName: "Integration",
        lastName: "Operator",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    operatorId = operator.id;
    const connection = await db.integrationConnection.create({
      data: { tenantKey: marker, system: "CERTIFICATION_ERP", connectionKey: "primary", name: "Certification", status: "ACTIVE", baseUrl: "https://cert.invalid", credentialsRef: "env:CERT_TOKEN" },
    });
    connectionId = connection.id;
  });

  afterAll(async () => {
    await db.integrationOutbox.deleteMany({ where: { idempotencyKey: { startsWith: marker } } });
    await db.integrationInbox.deleteMany({ where: { externalEventId: { startsWith: marker } } });
    await db.orderIntegrationState.deleteMany({ where: { tenantKey: marker } });
    await db.order.deleteMany({ where: { userId: operatorId } });
    await db.integrationConnection.deleteMany({ where: { id: connectionId } });
    await db.auditLog.deleteMany({ where: { actorId: operatorId } });
    await db.user.deleteMany({ where: { id: operatorId } });
  });

  it("allows one worker to reclaim a crashed lease and fences the stale worker", async () => {
    const row = await db.integrationOutbox.create({
      data: {
        aggregateType: "ORDER",
        aggregateId: `${marker}-order`,
        eventType: "ORDER_SUBMIT_REQUESTED",
        destination: marker,
        payload: {},
        idempotencyKey: `${marker}-reclaim`,
      },
    });
    const [workerA] = await claimIntegrationOutbox({ workerId: `${marker}-worker-a`, destination: marker, limit: 1 });
    expect(workerA?.id).toBe(row.id);
    await db.integrationOutbox.update({ where: { id: row.id }, data: { leaseExpiresAt: new Date(0) } });
    const [workerB] = await claimIntegrationOutbox({ workerId: `${marker}-worker-b`, destination: marker, limit: 1 });
    expect(workerB).toMatchObject({ id: row.id, fencingToken: workerA!.fencingToken + 1 });
    await expect(completeIntegrationOutbox(workerA!)).rejects.toBeInstanceOf(StaleIntegrationLeaseError);
    await expect(completeIntegrationOutbox(workerB!)).resolves.toBeUndefined();
    await expect(db.integrationOutbox.findUnique({ where: { id: row.id } })).resolves.toMatchObject({ status: "PROCESSED", leaseOwner: null });
  });

  it("uses SKIP LOCKED so two workers cannot claim the same due message", async () => {
    await db.integrationOutbox.create({
      data: {
        aggregateType: "ORDER",
        aggregateId: `${marker}-concurrent-order`,
        eventType: "ORDER_SUBMIT_REQUESTED",
        destination: `${marker}-concurrent`,
        payload: {},
        idempotencyKey: `${marker}-concurrent`,
      },
    });
    const [a, b] = await Promise.all([
      claimIntegrationOutbox({ workerId: `${marker}-worker-a`, destination: `${marker}-concurrent`, limit: 1 }),
      claimIntegrationOutbox({ workerId: `${marker}-worker-b`, destination: `${marker}-concurrent`, limit: 1 }),
    ]);
    expect(a.length + b.length).toBe(1);
  });

  it("conditionally heartbeats, dead-letters at max attempts and explicitly redrives", async () => {
    const row = await db.integrationOutbox.create({
      data: {
        aggregateType: "ORDER",
        aggregateId: `${marker}-dlq-order`,
        eventType: "ORDER_SUBMIT_REQUESTED",
        destination: `${marker}-dlq`,
        payload: {},
        idempotencyKey: `${marker}-dlq`,
      },
    });
    const [lease] = await claimIntegrationOutbox({ workerId: `${marker}-worker-dlq`, destination: `${marker}-dlq`, limit: 1 });
    const renewed = await heartbeatIntegrationOutbox(lease!);
    expect(renewed.leaseExpiresAt!.getTime()).toBeGreaterThan(lease!.leaseExpiresAt!.getTime());
    await expect(failIntegrationOutbox(renewed, new Error("certification failure"), 1)).resolves.toMatchObject({ dead: true });
    await expect(db.integrationOutbox.findUnique({ where: { id: row.id } })).resolves.toMatchObject({
      status: "DEAD",
      leaseOwner: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
      lastError: "certification failure",
    });
    await expect(redriveIntegrationOutbox(row.id, operatorId)).resolves.toMatchObject({ status: "PENDING", attempts: 1 });
    const [reclaimed] = await claimIntegrationOutbox({ workerId: `${marker}-worker-redrive`, destination: `${marker}-dlq`, limit: 1 });
    expect(reclaimed).toMatchObject({ id: row.id, attempts: 2, fencingToken: lease!.fencingToken + 1 });
  });

  it("deduplicates concurrent inbox delivery by source event identity", async () => {
    const input = { source: marker, externalEventId: `${marker}-event`, eventType: "ORDER_STATUS", payload: { ok: true } } as const;
    const [a, b] = await Promise.all([recordIntegrationInbound(input), recordIntegrationInbound(input)]);
    expect([a.replay, b.replay].sort()).toEqual([false, true]);
    expect(a.row.id).toBe(b.row.id);
  });

  it("exercises every certification outcome through claim, adapter and fenced persistence", async () => {
    const scenarios: ErpCertificationScenario[] = ["ACCEPT", "REJECT", "TIMEOUT", "HTTP_500", "DUPLICATE_RESPONSE", "DELAYED_RESPONSE"];
    for (const scenario of scenarios) {
      const order = await db.order.create({
        data: {
          orderNumber: `${marker}-${scenario}`,
          userId: operatorId,
          type: "B2B",
          currency: "AED",
          subtotal: 100,
          vatAmount: 5,
          total: 105,
          shippingAddress: { city: "Dubai" },
        },
      });
      await db.orderIntegrationState.create({ data: { tenantKey: marker, orderId: order.id, system: "CERTIFICATION_ERP" } });
      await db.integrationOutbox.create({
        data: {
          tenantKey: marker,
          aggregateType: "ORDER",
          aggregateId: order.id,
          eventType: "ORDER_SUBMIT_REQUESTED",
          destination: "CERTIFICATION_ERP",
          connectionId,
          idempotencyKey: `${marker}:${scenario}`,
          payload: { orderId: order.id, orderNumber: order.orderNumber, currency: "AED", total: 105, items: [{ productId: "p", sku: "SKU", quantity: 1, unitPrice: 100 }] },
        },
      });
      const [lease] = await claimIntegrationOutbox({ workerId: `${marker}-${scenario}`, destination: "CERTIFICATION_ERP", limit: 1 });
      const result = await processIntegrationOutboxMessage(lease!, new DeterministicCertificationErpAdapter(scenario));
      const stored = await db.integrationOutbox.findUniqueOrThrow({ where: { id: lease!.id } });
      if (["TIMEOUT", "HTTP_500"].includes(scenario)) {
        expect(result.status).toBe("RETRY");
        expect(stored.status).toBe("RETRY");
      } else {
        expect(stored.status).toBe("PROCESSED");
        await expect(db.orderIntegrationState.findUniqueOrThrow({
          where: { tenantKey_orderId_system: { tenantKey: marker, orderId: order.id, system: "CERTIFICATION_ERP" } },
        })).resolves.toMatchObject({ state: scenario === "REJECT" ? "REJECTED" : "ACCEPTED" });
      }
    }
  });

  it("recovers crash-after-accept with the same provider idempotency identity and rejects stale finalize", async () => {
    const order = await db.order.create({
      data: { orderNumber: `${marker}-CRASH`, userId: operatorId, type: "B2B", currency: "AED", subtotal: 100, vatAmount: 5, total: 105, shippingAddress: {} },
    });
    await db.orderIntegrationState.create({ data: { tenantKey: marker, orderId: order.id, system: "CERTIFICATION_ERP" } });
    await db.integrationOutbox.create({
      data: {
        tenantKey: marker, aggregateType: "ORDER", aggregateId: order.id, eventType: "ORDER_SUBMIT_REQUESTED",
        destination: "CERTIFICATION_ERP", connectionId, idempotencyKey: `${marker}:crash`,
        payload: { orderId: order.id, orderNumber: order.orderNumber, currency: "AED", total: 105, items: [{ productId: "p", sku: "SKU", quantity: 1, unitPrice: 100 }] },
      },
    });
    const [stale] = await claimIntegrationOutbox({ workerId: `${marker}-crashed`, destination: "CERTIFICATION_ERP", limit: 1 });
    const firstProviderResult = await new DeterministicCertificationErpAdapter("ACCEPT").submitOrder({
      orderId: order.id, orderNumber: order.orderNumber, idempotencyKey: stale!.idempotencyKey, currency: "AED", total: 105,
      items: [{ productId: "p", sku: "SKU", quantity: 1, unitPrice: 100 }],
    });
    await db.integrationOutbox.update({ where: { id: stale!.id }, data: { leaseExpiresAt: new Date(0) } });
    const [recovered] = await claimIntegrationOutbox({ workerId: `${marker}-recovered`, destination: "CERTIFICATION_ERP", limit: 1 });
    await processIntegrationOutboxMessage(recovered!, new DeterministicCertificationErpAdapter("ACCEPT"));
    const state = await db.orderIntegrationState.findUniqueOrThrow({
      where: { tenantKey_orderId_system: { tenantKey: marker, orderId: order.id, system: "CERTIFICATION_ERP" } },
    });
    expect(firstProviderResult).toMatchObject({ disposition: "ACCEPTED", externalOrderId: state.externalOrderId });
    await expect(completeIntegrationOutbox(stale!)).rejects.toBeInstanceOf(StaleIntegrationLeaseError);
  });
});
