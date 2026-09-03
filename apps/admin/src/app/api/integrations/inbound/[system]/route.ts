import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, recordIntegrationInbound } from "@avenick/database";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

const SigningIdentitySchema = z.object({
  keyId: z.string().trim().regex(/^[A-Za-z0-9._-]{1,128}$/),
  system: z.enum(["D365", "SAP", "ERP"]),
  connectionId: z.string().trim().min(1).max(128),
  secret: z.string().min(32).max(4096),
}).strict();

const SigningKeyringSchema = z.array(SigningIdentitySchema).min(1).max(100).superRefine((entries, context) => {
  const keyIds = new Set<string>();
  const connectionIds = new Set<string>();
  const secretFingerprints = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const secretFingerprint = crypto.createHash("sha256").update(entry.secret, "utf8").digest("hex");
    if (keyIds.has(entry.keyId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [index, "keyId"], message: "Duplicate signing key ID" });
    }
    if (connectionIds.has(entry.connectionId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [index, "connectionId"], message: "Duplicate connection binding" });
    }
    if (secretFingerprints.has(secretFingerprint)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [index, "secret"], message: "Duplicate signing secret" });
    }
    keyIds.add(entry.keyId);
    connectionIds.add(entry.connectionId);
    secretFingerprints.add(secretFingerprint);
  }
});

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

function signingKeyring() {
  const raw = process.env.INTEGRATION_WEBHOOK_SIGNING_KEYRING;
  if (!raw) return null;
  try {
    const result = SigningKeyringSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function signed(rawBody: string, keyId: string, timestamp: string, signature: string, secret: string) {
  if (!/^\d{10,13}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const numeric = Number(timestamp);
  const timestampMs = timestamp.length === 10 ? numeric * 1000 : numeric;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${keyId}.${timestamp}.${rawBody}`, "utf8").digest("hex");
  const supplied = Buffer.from(signature.toLowerCase(), "hex");
  const calculated = Buffer.from(expected, "hex");
  return supplied.length === calculated.length && crypto.timingSafeEqual(supplied, calculated);
}

/**
 * Provider contract: HMAC-SHA256 hex over
 * `<x-avenick-key-id>.<x-avenick-timestamp>.<raw body>`. The deployment-owned
 * keyring binds each key ID to exactly one system and connection. Tenant and
 * source are derived from that connection; callers cannot select any of them.
 */
export async function POST(request: NextRequest, context: { params: { system: string } }) {
  const system = context.params.system.trim().toUpperCase();
  const keyring = await signingKeyring();
  if (!keyring) {
    return NextResponse.json({ error: "Integration webhook is not configured" }, { status: 503 });
  }
  const keyId = request.headers.get("x-avenick-key-id") ?? "";
  const signingIdentity = keyring.find((entry) => entry.keyId === keyId);
  if (!signingIdentity || signingIdentity.system !== system) {
    return NextResponse.json({ error: "Invalid integration signature" }, { status: 401 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const timestamp = request.headers.get("x-avenick-timestamp") ?? "";
  const signature = request.headers.get("x-avenick-signature") ?? "";
  if (!signed(rawBody, keyId, timestamp, signature, signingIdentity.secret)) {
    return NextResponse.json({ error: "Invalid integration signature" }, { status: 401 });
  }

  const parsed = EventSchema.safeParse(await Promise.resolve().then(() => JSON.parse(rawBody)).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid integration event" }, { status: 400 });
  if (parsed.data.connectionId !== signingIdentity.connectionId) {
    return NextResponse.json({ error: "Signing key is not authorized for this connection" }, { status: 403 });
  }
  const connection = await db.integrationConnection.findFirst({
    where: { id: signingIdentity.connectionId, system: signingIdentity.system, status: "ACTIVE" },
    select: { tenantKey: true, system: true },
  });
  if (!connection) return NextResponse.json({ error: "Active integration connection not found" }, { status: 404 });
  const governedSubmission = await db.integrationOutbox.findFirst({
    where: {
      tenantKey: connection.tenantKey,
      connectionId: signingIdentity.connectionId,
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
    // Inbox idempotency is per governed connection. A tenant may legitimately
    // run multiple connections for one ERP system, whose provider event-id
    // sequences are not globally unique.
    source: `${connection.system}:${signingIdentity.connectionId}`,
    externalEventId: parsed.data.eventId,
    eventType: parsed.data.eventType,
    payload: { ...parsed.data.data, system: connection.system },
  });
  return NextResponse.json({ received: true, replay: result.replay }, { status: result.replay ? 200 : 202 });
}
