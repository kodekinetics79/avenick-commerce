import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  claimIntegrationInbox,
  db,
  DEPLOYED_INTEGRATION_INBOX_HANDLERS,
  processIntegrationInboxMessage,
} from "@avenick/database";
import { POST } from "./route";

const run = process.env.DATABASE_URL ? describe : describe.skip;
const marker = `signed-erp-ingress-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const secret = "signed-erp-ingress-test-secret-32-characters";
const keyId = `${marker}-primary`;
let actorId = "";
let orderId = "";
let connectionId = "";
let outboxId = "";
let priorKeyring: string | undefined;

function configureKeyring(entries: Array<{ keyId: string; system: string; connectionId: string; secret: string }>) {
  process.env.INTEGRATION_WEBHOOK_SIGNING_KEYRING = JSON.stringify(entries);
}

function request(body: string, signing = { keyId, secret }) {
  const timestamp = String(Date.now());
  const signature = crypto.createHmac("sha256", signing.secret)
    .update(`${signing.keyId}.${timestamp}.${body}`, "utf8")
    .digest("hex");
  return new NextRequest("http://localhost/api/integrations/inbound/ERP", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-avenick-key-id": signing.keyId,
      "x-avenick-timestamp": timestamp,
      "x-avenick-signature": signature,
    },
    body,
  });
}

run("signed ERP ingress lifecycle", () => {
  beforeAll(async () => {
    priorKeyring = process.env.INTEGRATION_WEBHOOK_SIGNING_KEYRING;
    const actor = await db.user.create({ data: {
      email: `${marker}@example.test`, firstName: "ERP", lastName: "Ingress", role: "ADMIN", status: "ACTIVE",
    } });
    actorId = actor.id;
    const order = await db.order.create({ data: {
      orderNumber: marker, userId: actor.id, type: "B2B", currency: "AED",
      subtotal: 100, vatAmount: 5, total: 105, shippingAddress: { city: "Dubai" },
    } });
    orderId = order.id;
    const connection = await db.integrationConnection.create({ data: {
      tenantKey: marker, system: "ERP", connectionKey: marker, name: marker, status: "ACTIVE",
    } });
    connectionId = connection.id;
    configureKeyring([{ keyId, system: "ERP", connectionId, secret }]);
    const outbox = await db.integrationOutbox.create({ data: {
      tenantKey: marker, connectionId, aggregateType: "ORDER", aggregateId: orderId,
      eventType: "ORDER_SUBMIT_REQUESTED", destination: "ERP", payload: { orderId },
      idempotencyKey: `${marker}:submit`, status: "PROCESSED", processedAt: new Date(),
    } });
    outboxId = outbox.id;
    await db.orderIntegrationState.create({ data: {
      tenantKey: marker, orderId, system: "ERP", state: "PENDING_VALIDATION",
    } });
  });

  afterAll(async () => {
    if (priorKeyring == null) delete process.env.INTEGRATION_WEBHOOK_SIGNING_KEYRING;
    else process.env.INTEGRATION_WEBHOOK_SIGNING_KEYRING = priorKeyring;
    await db.integrationInbox.deleteMany({ where: { tenantKey: marker } });
    await db.integrationOutbox.deleteMany({ where: { id: outboxId } });
    await db.orderIntegrationState.deleteMany({ where: { tenantKey: marker, orderId } });
    await db.integrationConnection.deleteMany({ where: { id: connectionId } });
    await db.order.deleteMany({ where: { id: orderId } });
    await db.user.deleteMany({ where: { id: actorId } });
  });

  it("authenticates, deduplicates, and dispatches a delayed terminal status", async () => {
    const body = JSON.stringify({
      eventId: `${marker}-delayed`,
      eventType: "ORDER_STATUS_CHANGED",
      connectionId,
      data: { orderId, status: "ACCEPTED", externalOrderId: "ERP-DELAYED-100", correlationId: "corr-delayed" },
    });

    const rejected = await POST(request(body, { keyId, secret: `${secret}-wrong` }), { params: { system: "ERP" } });
    expect(rejected.status).toBe(401);
    expect(await db.integrationInbox.count({ where: { tenantKey: marker } })).toBe(0);

    const first = await POST(request(body), { params: { system: "ERP" } });
    expect(first.status).toBe(202);
    await expect(first.json()).resolves.toMatchObject({ received: true, replay: false });
    const replay = await POST(request(body), { params: { system: "ERP" } });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ received: true, replay: true });
    expect(await db.integrationInbox.count({ where: { tenantKey: marker } })).toBe(1);

    const [lease] = await claimIntegrationInbox({ workerId: `${marker}-worker`, source: `ERP:${connectionId}`, limit: 1 });
    const processed = await processIntegrationInboxMessage(
      lease!,
      DEPLOYED_INTEGRATION_INBOX_HANDLERS["*:ORDER_STATUS_CHANGED"]!,
    );
    expect(processed.status).toBe("PROCESSED");
    await expect(db.orderIntegrationState.findUniqueOrThrow({
      where: { tenantKey_orderId_system: { tenantKey: marker, orderId, system: "ERP" } },
    })).resolves.toMatchObject({ state: "ACCEPTED", externalOrderId: "ERP-DELAYED-100", correlationId: "corr-delayed" });
  });

  it("keeps the same provider event id distinct across governed connections", async () => {
    const order = await db.order.create({ data: {
      orderNumber: `${marker}-second`, userId: actorId, type: "B2B", currency: "AED",
      subtotal: 200, vatAmount: 10, total: 210, shippingAddress: { city: "Dubai" },
    } });
    const connection = await db.integrationConnection.create({ data: {
      tenantKey: marker, system: "ERP", connectionKey: `${marker}-second`, name: `${marker}-second`, status: "ACTIVE",
    } });
    const secondKeyId = `${marker}-second`;
    const secondSecret = "signed-erp-ingress-second-secret-32-chars";
    configureKeyring([
      { keyId, system: "ERP", connectionId, secret },
      { keyId: secondKeyId, system: "ERP", connectionId: connection.id, secret: secondSecret },
    ]);
    const outbox = await db.integrationOutbox.create({ data: {
      tenantKey: marker, connectionId: connection.id, aggregateType: "ORDER", aggregateId: order.id,
      eventType: "ORDER_SUBMIT_REQUESTED", destination: "ERP", payload: { orderId: order.id },
      idempotencyKey: `${marker}:second:submit`, status: "PROCESSED", processedAt: new Date(),
    } });
    await db.orderIntegrationState.create({ data: {
      tenantKey: marker, orderId: order.id, system: "ERP", state: "PENDING_VALIDATION",
    } });

    try {
      const sharedEventId = `${marker}-same-provider-sequence`;
      const firstBody = JSON.stringify({
        eventId: sharedEventId, eventType: "ORDER_STATUS_CHANGED", connectionId,
        data: { orderId, status: "ACCEPTED", externalOrderId: "ERP-FIRST" },
      });
      const secondBody = JSON.stringify({
        eventId: sharedEventId, eventType: "ORDER_STATUS_CHANGED", connectionId: connection.id,
        data: { orderId: order.id, status: "REJECTED", reason: "SECOND_CONNECTION_REJECTED" },
      });
      const crossConnection = await POST(request(secondBody), { params: { system: "ERP" } });
      expect(crossConnection.status).toBe(403);
      expect(await db.integrationInbox.count({
        where: { tenantKey: marker, source: `ERP:${connection.id}`, externalEventId: sharedEventId },
      })).toBe(0);

      const [first, second] = await Promise.all([
        POST(request(firstBody), { params: { system: "ERP" } }),
        POST(request(secondBody, { keyId: secondKeyId, secret: secondSecret }), { params: { system: "ERP" } }),
      ]);
      expect([first.status, second.status]).toEqual([202, 202]);
      const rows = await db.integrationInbox.findMany({ where: { tenantKey: marker, externalEventId: sharedEventId } });
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((row) => row.source))).toEqual(new Set([`ERP:${connectionId}`, `ERP:${connection.id}`]));

      const [[firstLease], [secondLease]] = await Promise.all([
        claimIntegrationInbox({ workerId: `${marker}-first-connection`, source: `ERP:${connectionId}`, limit: 1 }),
        claimIntegrationInbox({ workerId: `${marker}-second-connection`, source: `ERP:${connection.id}`, limit: 1 }),
      ]);
      const results = await Promise.all([firstLease!, secondLease!].map((lease) => processIntegrationInboxMessage(
        lease, DEPLOYED_INTEGRATION_INBOX_HANDLERS["*:ORDER_STATUS_CHANGED"]!,
      )));
      expect(results.map((result) => result.status)).toEqual(["PROCESSED", "PROCESSED"]);
      await expect(db.orderIntegrationState.findUniqueOrThrow({
        where: { tenantKey_orderId_system: { tenantKey: marker, orderId, system: "ERP" } },
      })).resolves.toMatchObject({ state: "ACCEPTED", externalOrderId: "ERP-FIRST" });
      await expect(db.orderIntegrationState.findUniqueOrThrow({
        where: { tenantKey_orderId_system: { tenantKey: marker, orderId: order.id, system: "ERP" } },
      })).resolves.toMatchObject({ state: "REJECTED", rejectionReason: "SECOND_CONNECTION_REJECTED" });
    } finally {
      configureKeyring([{ keyId, system: "ERP", connectionId, secret }]);
      await db.integrationInbox.deleteMany({ where: { tenantKey: marker, source: `ERP:${connection.id}` } });
      await db.orderIntegrationState.deleteMany({ where: { tenantKey: marker, orderId: order.id } });
      await db.integrationOutbox.deleteMany({ where: { id: outbox.id } });
      await db.integrationConnection.deleteMany({ where: { id: connection.id } });
      await db.order.deleteMany({ where: { id: order.id } });
    }
  });
});
