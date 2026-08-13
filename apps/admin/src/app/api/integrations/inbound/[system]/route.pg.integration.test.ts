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
let actorId = "";
let orderId = "";
let connectionId = "";
let outboxId = "";
let priorSecret: string | undefined;

function request(body: string, signatureSecret = secret) {
  const timestamp = String(Date.now());
  const signature = crypto.createHmac("sha256", signatureSecret).update(`${timestamp}.${body}`, "utf8").digest("hex");
  return new NextRequest("http://localhost/api/integrations/inbound/ERP", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-avenick-timestamp": timestamp,
      "x-avenick-signature": signature,
    },
    body,
  });
}

run("signed ERP ingress lifecycle", () => {
  beforeAll(async () => {
    priorSecret = process.env.INTEGRATION_ERP_WEBHOOK_SECRET;
    process.env.INTEGRATION_ERP_WEBHOOK_SECRET = secret;
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
    if (priorSecret == null) delete process.env.INTEGRATION_ERP_WEBHOOK_SECRET;
    else process.env.INTEGRATION_ERP_WEBHOOK_SECRET = priorSecret;
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

    const rejected = await POST(request(body, `${secret}-wrong`), { params: { system: "ERP" } });
    expect(rejected.status).toBe(401);
    expect(await db.integrationInbox.count({ where: { tenantKey: marker } })).toBe(0);

    const first = await POST(request(body), { params: { system: "ERP" } });
    expect(first.status).toBe(202);
    await expect(first.json()).resolves.toMatchObject({ received: true, replay: false });
    const replay = await POST(request(body), { params: { system: "ERP" } });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ received: true, replay: true });
    expect(await db.integrationInbox.count({ where: { tenantKey: marker } })).toBe(1);

    const [lease] = await claimIntegrationInbox({ workerId: `${marker}-worker`, source: "ERP", limit: 1 });
    const processed = await processIntegrationInboxMessage(
      lease!,
      DEPLOYED_INTEGRATION_INBOX_HANDLERS["*:ORDER_STATUS_CHANGED"]!,
    );
    expect(processed.status).toBe("PROCESSED");
    await expect(db.orderIntegrationState.findUniqueOrThrow({
      where: { tenantKey_orderId_system: { tenantKey: marker, orderId, system: "ERP" } },
    })).resolves.toMatchObject({ state: "ACCEPTED", externalOrderId: "ERP-DELAYED-100", correlationId: "corr-delayed" });
  });
});
