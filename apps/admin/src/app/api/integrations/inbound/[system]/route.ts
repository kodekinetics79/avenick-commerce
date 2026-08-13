import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, recordIntegrationInbound } from "@avenick/database";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

const EventSchema = z.object({
  eventId: z.string().trim().min(1).max(128),
  eventType: z.enum(["ORDER_STATUS", "ORDER_STATUS_CHANGED"]),
  connectionId: z.string().trim().min(1).max(128),
  data: z.object({
    orderId: z.string().trim().min(1).max(128),
    status: z.enum(["ACCEPTED", "REJECTED"]),
    externalOrderId: z.string().trim().min(1).max(256).optional(),
    correlationId: z.string().trim().min(1).max(256).optional(),
    reason: z.string().trim().min(1).max(4000).optional(),
  }).strict(),
}).strict();

function webhookSecret(system: string): string | undefined {
  switch (system) {
    case "D365": return process.env.INTEGRATION_D365_WEBHOOK_SECRET;
    case "SAP": return process.env.INTEGRATION_SAP_WEBHOOK_SECRET;
    case "ERP": return process.env.INTEGRATION_ERP_WEBHOOK_SECRET;
    default: return undefined;
  }
}

function signed(rawBody: string, timestamp: string, signature: string, secret: string) {
  if (!/^\d{10,13}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const numeric = Number(timestamp);
  const timestampMs = timestamp.length === 10 ? numeric * 1000 : numeric;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const supplied = Buffer.from(signature.toLowerCase(), "hex");
  const calculated = Buffer.from(expected, "hex");
  return supplied.length === calculated.length && crypto.timingSafeEqual(supplied, calculated);
}

/**
 * Provider contract: HMAC-SHA256 hex over `<x-avenick-timestamp>.<raw body>`.
 * Tenant and source are derived from the deployment-governed active connection;
 * callers cannot select either or name an environment secret.
 */
export async function POST(request: NextRequest, context: { params: { system: string } }) {
  const system = context.params.system.trim().toUpperCase();
  const secret = webhookSecret(system);
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "Integration webhook is not configured" }, { status: 503 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const timestamp = request.headers.get("x-avenick-timestamp") ?? "";
  const signature = request.headers.get("x-avenick-signature") ?? "";
  if (!signed(rawBody, timestamp, signature, secret)) {
    return NextResponse.json({ error: "Invalid integration signature" }, { status: 401 });
  }

  const parsed = EventSchema.safeParse(await Promise.resolve().then(() => JSON.parse(rawBody)).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid integration event" }, { status: 400 });
  const connection = await db.integrationConnection.findFirst({
    where: { id: parsed.data.connectionId, system, status: "ACTIVE" },
    select: { tenantKey: true, system: true },
  });
  if (!connection) return NextResponse.json({ error: "Active integration connection not found" }, { status: 404 });
  const governedSubmission = await db.integrationOutbox.findFirst({
    where: {
      tenantKey: connection.tenantKey,
      connectionId: parsed.data.connectionId,
      destination: connection.system,
      aggregateType: "ORDER",
      aggregateId: parsed.data.data.orderId,
      eventType: "ORDER_SUBMIT_REQUESTED",
    },
    select: { id: true },
  });
  if (!governedSubmission) {
    return NextResponse.json({ error: "Order is not governed by this integration connection" }, { status: 409 });
  }

  const result = await recordIntegrationInbound({
    tenantKey: connection.tenantKey,
    source: connection.system,
    externalEventId: parsed.data.eventId,
    eventType: parsed.data.eventType,
    payload: { ...parsed.data.data, system: connection.system },
  });
  return NextResponse.json({ received: true, replay: result.replay }, { status: result.replay ? 200 : 202 });
}
