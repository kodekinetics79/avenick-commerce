import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
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
  });

  afterAll(async () => {
    await db.integrationOutbox.deleteMany({ where: { idempotencyKey: { startsWith: marker } } });
    await db.integrationInbox.deleteMany({ where: { externalEventId: { startsWith: marker } } });
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
});
